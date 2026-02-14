// Stability Pool - Liquidation absorption + interest yield distribution
// Uses Liquity-style O(1) product/sum accounting

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
        // Global accumulators
        total_deposits: u256,
        product_p: u256,
        sum_s: Map<felt252, u256>,
        current_epoch: u256,
        current_scale: u256,
        // Collateral tracking
        collateral_balances: Map<felt252, u256>,
        collateral_tokens: Map<felt252, ContractAddress>,
        // Interest yield
        pending_interest_yield: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposited: Deposited,
        Withdrawn: Withdrawn,
        LiquidationAbsorbed: LiquidationAbsorbed,
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

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        moonusd_token: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.moonusd_token.write(moonusd_token);
        self.product_p.write(SCALE); // Initialize P to 1.0
        self.current_epoch.write(0);
        self.current_scale.write(0);
    }

    #[abi(embed_v0)]
    impl StabilityPoolImpl of moonight::interfaces::i_stability_pool::IStabilityPool<ContractState> {
        fn deposit(ref self: ContractState, amount: u256) {
            assert(amount > 0, 'Zero deposit');
            let caller = get_caller_address();

            // Transfer moonUSD from depositor
            let moonusd = IMoonUSDDispatcher { contract_address: self.moonusd_token.read() };
            let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };
            token.transfer_from(caller, starknet::get_contract_address(), amount);

            // Take snapshot for depositor
            let current_deposit = self.deposits.read(caller);
            let new_deposit = current_deposit + amount;
            self.deposits.write(caller, new_deposit);
            self.deposit_snapshot_p.write(caller, self.product_p.read());
            self.deposit_snapshot_epoch.write(caller, self.current_epoch.read());
            self.deposit_snapshot_scale.write(caller, self.current_scale.read());

            self.total_deposits.write(self.total_deposits.read() + amount);

            self.emit(Deposited { depositor: caller, amount });
        }

        fn withdraw(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            let compounded = self._get_compounded_deposit(caller);
            assert(amount <= compounded, 'Exceeds compounded deposit');

            let deposit = self.deposits.read(caller);
            let new_deposit = if amount >= deposit { 0 } else { deposit - amount };
            self.deposits.write(caller, new_deposit);

            // Update snapshot
            self.deposit_snapshot_p.write(caller, self.product_p.read());
            self.deposit_snapshot_epoch.write(caller, self.current_epoch.read());
            self.deposit_snapshot_scale.write(caller, self.current_scale.read());

            self.total_deposits.write(self.total_deposits.read() - amount);

            // Transfer moonUSD back
            let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };
            token.transfer(caller, amount);

            self.emit(Withdrawn { depositor: caller, amount });
        }

        fn claim_collateral_gains(ref self: ContractState) {
            // Claim accumulated collateral gains from liquidations
            // Simplified: would iterate over known collateral types
        }

        fn claim_interest_yield(ref self: ContractState) {
            // Claim accumulated interest yield
        }

        fn absorb_liquidation(
            ref self: ContractState,
            debt_amount: u256,
            collateral_type: felt252,
            collateral_amount: u256,
        ) {
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

            // Epoch reset if P drops too low
            if new_p < 1_000_000_000 { // < 10^9
                self.current_epoch.write(self.current_epoch.read() + 1);
                self.product_p.write(SCALE);
            } else {
                self.product_p.write(new_p);
            }

            // Burn moonUSD
            let moonusd = IMoonUSDDispatcher { contract_address: self.moonusd_token.read() };
            moonusd.burn(starknet::get_contract_address(), debt_amount);

            self.total_deposits.write(total - debt_amount);

            // Track collateral balance
            let current_col_bal = self.collateral_balances.read(collateral_type);
            self.collateral_balances.write(collateral_type, current_col_bal + collateral_amount);

            self.emit(LiquidationAbsorbed { debt_amount, collateral_type, collateral_amount });
        }

        fn distribute_interest(ref self: ContractState, amount: u256) {
            let current = self.pending_interest_yield.read();
            self.pending_interest_yield.write(current + amount);
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
            let deposit = self.deposits.read(depositor);
            if deposit == 0 { return 0; }

            let snapshot_s = self.deposit_snapshot_s.read((depositor, collateral_type));
            let current_s = self.sum_s.read(collateral_type);
            let snapshot_p = self.deposit_snapshot_p.read(depositor);

            if snapshot_p == 0 { return 0; }
            deposit * (current_s - snapshot_s) / snapshot_p
        }

        fn get_compounded_deposit(self: @ContractState, depositor: ContractAddress) -> u256 {
            self._get_compounded_deposit(depositor)
        }
    }

    // Allow CDPManager to be set
    #[external(v0)]
    fn set_cdp_manager(ref self: ContractState, cdp_manager: ContractAddress) {
        self.ownable.assert_only_owner();
        self.cdp_manager.write(cdp_manager);
    }

    #[external(v0)]
    fn set_collateral_token(ref self: ContractState, key: felt252, token: ContractAddress) {
        self.ownable.assert_only_owner();
        self.collateral_tokens.write(key, token);
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

            // If epoch changed, deposit is fully absorbed
            if snapshot_epoch < current_epoch {
                return 0;
            }

            let current_p = self.product_p.read();
            deposit * current_p / snapshot_p
        }
    }
}
