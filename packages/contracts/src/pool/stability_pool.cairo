// Stability Pool - Liquidation absorption + interest yield distribution
// Uses Liquity-style O(1) product/sum accounting:
//   P (product) for deposit compounding after liquidations
//   S (sum) for collateral gain tracking per collateral type
//   G (sum) for interest yield distribution

#[starknet::contract]
pub mod StabilityPool {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use moonight::interfaces::i_moonusd::{IMoonUSDDispatcher, IMoonUSDDispatcherTrait};
    use moonight::math::fixed_point::{SCALE, mul_fp, div_fp};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const NOT_ENTERED: felt252 = 'NOT_ENTERED';
    const ENTERED: felt252 = 'ENTERED';

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        moonusd_token: ContractAddress,
        cdp_manager: ContractAddress,
        // Depositor tracking
        deposits: Map<ContractAddress, u256>,
        deposit_snapshot_p: Map<ContractAddress, u256>,
        deposit_snapshot_s: Map<(ContractAddress, felt252), u256>,
        deposit_snapshot_epoch: Map<ContractAddress, u256>,
        deposit_snapshot_scale: Map<ContractAddress, u256>,
        // Interest yield — G-sum accounting
        interest_sum_g: u256,
        deposit_snapshot_g: Map<ContractAddress, u256>,
        // Global accumulators
        total_deposits: u256,
        product_p: u256,
        sum_s: Map<felt252, u256>,
        current_epoch: u256,
        current_scale: u256,
        // Collateral tracking
        collateral_balances: Map<felt252, u256>,
        collateral_tokens: Map<felt252, ContractAddress>,
        collateral_count: u32,
        collateral_keys: Map<u32, felt252>,
        // Reentrancy guard
        reentrancy_status: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposited: Deposited,
        Withdrawn: Withdrawn,
        LiquidationAbsorbed: LiquidationAbsorbed,
        InterestDistributed: InterestDistributed,
        InterestClaimed: InterestClaimed,
        CollateralClaimed: CollateralClaimed,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposited {
        #[key]
        depositor: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawn {
        #[key]
        depositor: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidationAbsorbed {
        debt_amount: u256,
        collateral_type: felt252,
        collateral_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct InterestDistributed {
        amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct InterestClaimed {
        #[key]
        depositor: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct CollateralClaimed {
        #[key]
        depositor: ContractAddress,
        collateral_type: felt252,
        amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        moonusd_token: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.moonusd_token.write(moonusd_token);
        self.product_p.write(SCALE);
        self.current_epoch.write(0);
        self.current_scale.write(0);
        self.interest_sum_g.write(0);
        self.collateral_count.write(0);
        self.reentrancy_status.write(NOT_ENTERED);
    }

    #[abi(embed_v0)]
    impl StabilityPoolImpl of moonight::interfaces::i_stability_pool::IStabilityPool<ContractState> {
        fn deposit(ref self: ContractState, amount: u256) {
            self._enter();
            assert(amount > 0, 'Zero deposit');
            let caller = get_caller_address();

            // Auto-claim pending interest before updating snapshot
            self._claim_interest_internal(caller);

            // Transfer moonUSD from depositor
            let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };
            token.transfer_from(caller, starknet::get_contract_address(), amount);

            // Update deposit
            let current_deposit = self.deposits.read(caller);
            let new_deposit = current_deposit + amount;
            self.deposits.write(caller, new_deposit);

            // Take snapshots
            self.deposit_snapshot_p.write(caller, self.product_p.read());
            self.deposit_snapshot_epoch.write(caller, self.current_epoch.read());
            self.deposit_snapshot_scale.write(caller, self.current_scale.read());
            self.deposit_snapshot_g.write(caller, self.interest_sum_g.read());

            self.total_deposits.write(self.total_deposits.read() + amount);

            self.emit(Deposited { depositor: caller, amount });
            self._exit();
        }

        fn withdraw(ref self: ContractState, amount: u256) {
            self._enter();
            let caller = get_caller_address();
            let compounded = self._get_compounded_deposit(caller);
            assert(amount <= compounded, 'Exceeds compounded deposit');

            // Auto-claim pending interest before updating snapshot
            self._claim_interest_internal(caller);

            // Use compounded deposit for subtraction (not raw deposit)
            let new_deposit = if amount >= compounded { 0 } else { compounded - amount };
            self.deposits.write(caller, new_deposit);

            // Update snapshots
            self.deposit_snapshot_p.write(caller, self.product_p.read());
            self.deposit_snapshot_epoch.write(caller, self.current_epoch.read());
            self.deposit_snapshot_scale.write(caller, self.current_scale.read());
            self.deposit_snapshot_g.write(caller, self.interest_sum_g.read());

            self.total_deposits.write(self.total_deposits.read() - amount);

            // Transfer moonUSD back
            let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };
            token.transfer(caller, amount);

            self.emit(Withdrawn { depositor: caller, amount });
            self._exit();
        }

        fn claim_collateral_gains(ref self: ContractState) {
            self._enter();
            let caller = get_caller_address();
            let deposit = self.deposits.read(caller);
            assert(deposit > 0, 'No deposit');

            let count = self.collateral_count.read();
            let mut i: u32 = 0;
            while i < count {
                let col_key = self.collateral_keys.read(i);
                let gain = self._get_collateral_gain(caller, col_key);
                if gain > 0 {
                    let col_token_addr = self.collateral_tokens.read(col_key);
                    let zero: ContractAddress = starknet::contract_address_const::<0>();
                    if col_token_addr != zero {
                        let col_token = IERC20Dispatcher { contract_address: col_token_addr };
                        col_token.transfer(caller, gain);

                        let bal = self.collateral_balances.read(col_key);
                        self.collateral_balances.write(col_key, bal - gain);

                        self.emit(CollateralClaimed {
                            depositor: caller,
                            collateral_type: col_key,
                            amount: gain,
                        });
                    }
                }
                // Update S snapshot for this collateral type
                self.deposit_snapshot_s.write((caller, col_key), self.sum_s.read(col_key));
                i += 1;
            };
            self._exit();
        }

        fn claim_interest_yield(ref self: ContractState) {
            self._enter();
            let caller = get_caller_address();
            self._claim_interest_internal(caller);
            self._exit();
        }

        fn absorb_liquidation(
            ref self: ContractState,
            debt_amount: u256,
            collateral_type: felt252,
            collateral_amount: u256,
        ) {
            self._enter();
            let caller = get_caller_address();
            assert(caller == self.cdp_manager.read(), 'Only CDPManager');

            let total = self.total_deposits.read();
            assert(total >= debt_amount, 'SP insufficient');

            // Update sum_s (collateral gain per unit)
            if total > 0 {
                let collateral_per_unit = collateral_amount * SCALE / total;
                let current_s = self.sum_s.read(collateral_type);
                self.sum_s.write(collateral_type, current_s + mul_fp(collateral_per_unit, self.product_p.read()));
            }

            // Update product_p (moonUSD loss ratio)
            let loss_per_unit = debt_amount * SCALE / total;
            let new_p = mul_fp(self.product_p.read(), SCALE - loss_per_unit);

            if new_p < 1_000_000_000 {
                self.current_epoch.write(self.current_epoch.read() + 1);
                self.product_p.write(SCALE);
            } else {
                self.product_p.write(new_p);
            }

            // Burn moonUSD
            let moonusd = IMoonUSDDispatcher { contract_address: self.moonusd_token.read() };
            moonusd.burn(starknet::get_contract_address(), debt_amount);

            self.total_deposits.write(total - debt_amount);

            let current_col_bal = self.collateral_balances.read(collateral_type);
            self.collateral_balances.write(collateral_type, current_col_bal + collateral_amount);

            self.emit(LiquidationAbsorbed { debt_amount, collateral_type, collateral_amount });
            self._exit();
        }

        fn distribute_interest(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            assert(caller == self.cdp_manager.read(), 'Only CDPManager');

            let total = self.total_deposits.read();
            if total == 0 || amount == 0 {
                return;
            }

            // G += amount * SCALE / total_deposits
            let interest_per_unit = amount * SCALE / total;
            let current_g = self.interest_sum_g.read();
            self.interest_sum_g.write(current_g + interest_per_unit);

            self.emit(InterestDistributed {
                amount,
                timestamp: get_block_timestamp(),
            });
        }

        fn get_total_deposits(self: @ContractState) -> u256 {
            self.total_deposits.read()
        }

        fn get_depositor_balance(self: @ContractState, depositor: ContractAddress) -> u256 {
            self.deposits.read(depositor)
        }

        fn get_depositor_collateral_gain(
            self: @ContractState, depositor: ContractAddress, collateral_type: felt252,
        ) -> u256 {
            self._get_collateral_gain(depositor, collateral_type)
        }

        fn get_compounded_deposit(self: @ContractState, depositor: ContractAddress) -> u256 {
            self._get_compounded_deposit(depositor)
        }

        fn get_pending_interest_yield(self: @ContractState, depositor: ContractAddress) -> u256 {
            let deposit = self.deposits.read(depositor);
            if deposit == 0 { return 0; }

            let current_g = self.interest_sum_g.read();
            let snapshot_g = self.deposit_snapshot_g.read(depositor);

            if current_g <= snapshot_g { return 0; }

            deposit * (current_g - snapshot_g) / SCALE
        }
    }

    #[external(v0)]
    fn set_cdp_manager(ref self: ContractState, cdp_manager: ContractAddress) {
        self.ownable.assert_only_owner();
        self.cdp_manager.write(cdp_manager);
    }

    #[external(v0)]
    fn set_collateral_token(ref self: ContractState, key: felt252, token: ContractAddress) {
        self.ownable.assert_only_owner();
        self.collateral_tokens.write(key, token);

        // Register collateral key if new
        let count = self.collateral_count.read();
        let mut found = false;
        let mut i: u32 = 0;
        while i < count {
            if self.collateral_keys.read(i) == key {
                found = true;
                break;
            }
            i += 1;
        };
        if !found {
            self.collateral_keys.write(count, key);
            self.collateral_count.write(count + 1);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_compounded_deposit(self: @ContractState, depositor: ContractAddress) -> u256 {
            let deposit = self.deposits.read(depositor);
            if deposit == 0 { return 0; }

            let snapshot_p = self.deposit_snapshot_p.read(depositor);
            if snapshot_p == 0 { return 0; }

            let snapshot_epoch = self.deposit_snapshot_epoch.read(depositor);
            let current_epoch = self.current_epoch.read();

            if snapshot_epoch < current_epoch {
                return 0;
            }

            let current_p = self.product_p.read();
            deposit * current_p / snapshot_p
        }

        fn _get_collateral_gain(
            self: @ContractState, depositor: ContractAddress, collateral_type: felt252,
        ) -> u256 {
            let deposit = self.deposits.read(depositor);
            if deposit == 0 { return 0; }

            let snapshot_s = self.deposit_snapshot_s.read((depositor, collateral_type));
            let current_s = self.sum_s.read(collateral_type);
            let snapshot_p = self.deposit_snapshot_p.read(depositor);

            if snapshot_p == 0 { return 0; }
            deposit * (current_s - snapshot_s) / snapshot_p
        }

        fn _claim_interest_internal(ref self: ContractState, depositor: ContractAddress) {
            let deposit = self.deposits.read(depositor);
            if deposit == 0 { return; }

            let current_g = self.interest_sum_g.read();
            let snapshot_g = self.deposit_snapshot_g.read(depositor);

            if current_g > snapshot_g {
                let pending = deposit * (current_g - snapshot_g) / SCALE;

                if pending > 0 {
                    let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };
                    token.transfer(depositor, pending);

                    self.emit(InterestClaimed { depositor, amount: pending });
                }
            }

            self.deposit_snapshot_g.write(depositor, current_g);
        }

        fn _enter(ref self: ContractState) {
            assert(self.reentrancy_status.read() != ENTERED, 'Reentrant call');
            self.reentrancy_status.write(ENTERED);
        }

        fn _exit(ref self: ContractState) {
            self.reentrancy_status.write(NOT_ENTERED);
        }
    }
}
