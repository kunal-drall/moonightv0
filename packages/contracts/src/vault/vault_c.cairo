// Vault C - Yield Optimizer (vmoonUSD, ERC-4626 compliant)
//
// Accepts moonUSD deposits and allocates across registered yield adapters
// using softmax-weighted allocation based on adapter APYs.
//
// Adapters:
//   - SP Adapter      — Stability Pool interest yield
//   - Ekubo Adapter   — LP fees on moonUSD/USDC pair (stub)
//   - strkBTC Adapter — BTC staking yield (stub)
//
// The vault mints vmoonUSD (vault shares) 1:1 initially, with price-per-share
// increasing as yield compounds. A 15% performance fee is deducted on compound
// and sent to the treasury.

#[starknet::contract]
pub mod VaultC {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use moonight::interfaces::i_yield_adapter::{IYieldAdapterDispatcher, IYieldAdapterDispatcherTrait};
    use moonight::math::fixed_point::SCALE;
    use moonight::math::softmax::softmax_allocate;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const BPS: u256 = 10_000;
    const COMPOUND_INTERVAL: u64 = 82800; // 23 hours in seconds
    const MIN_DEPOSIT: u256 = 100_000_000_000_000_000_000; // 100 moonUSD (18 dec)
    const MAX_DEPOSIT_PER_TX: u256 = 50_000_000_000_000_000_000_000; // 50,000 moonUSD
    const DEFAULT_TVL_CAP: u256 = 500_000_000_000_000_000_000_000; // 500,000 moonUSD
    const GAMMA_BPS: u256 = 15000; // 1.5 exponent for softmax

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        moonusd_token: ContractAddress,
        usdc_token: ContractAddress,
        // Adapter registry
        adapter_count: u256,
        adapters: Map<u256, ContractAddress>,
        adapter_min_weight: Map<u256, u256>, // min weight in BPS
        adapter_max_weight: Map<u256, u256>, // max weight in BPS
        adapter_current_weight: Map<u256, u256>, // current weight in BPS
        // Total assets under management
        total_assets_cached: u256,
        // Yield tracking
        last_compound_time: u64,
        cumulative_yield: u256,
        // Fees
        performance_fee_bps: u256,
        treasury: ContractAddress,
        // TVL cap
        tvl_cap: u256,
        // Access control
        keeper: ContractAddress,
        paused: bool,
        // Reentrancy guard
        reentrancy_status: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        DepositEvent: DepositEvent,
        WithdrawEvent: WithdrawEvent,
        Compound: Compound,
        Reallocate: Reallocate,
        AdapterAdded: AdapterAdded,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositEvent {
        #[key]
        sender: ContractAddress,
        #[key]
        receiver: ContractAddress,
        assets: u256,
        shares: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct WithdrawEvent {
        #[key]
        sender: ContractAddress,
        #[key]
        receiver: ContractAddress,
        #[key]
        owner: ContractAddress,
        assets: u256,
        shares: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Compound {
        yield_earned: u256,
        fee_taken: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Reallocate {
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct AdapterAdded {
        #[key]
        index: u256,
        adapter: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        moonusd_token: ContractAddress,
        usdc_token: ContractAddress,
    ) {
        self.erc20.initializer("vmoonUSD", "vmUSD");
        self.ownable.initializer(owner);
        self.moonusd_token.write(moonusd_token);
        self.usdc_token.write(usdc_token);
        self.adapter_count.write(0);
        self.performance_fee_bps.write(1500); // 15% perf fee
        self.tvl_cap.write(DEFAULT_TVL_CAP);
        self.paused.write(false);
        self.reentrancy_status.write('NOT_ENTERED');
    }

    #[abi(embed_v0)]
    impl VaultCImpl of moonight::interfaces::i_vault_c::IVaultC<ContractState> {
        fn asset(self: @ContractState) -> ContractAddress {
            self.moonusd_token.read()
        }

        fn total_assets(self: @ContractState) -> u256 {
            self.total_assets_cached.read()
        }

        fn convert_to_shares(self: @ContractState, assets: u256) -> u256 {
            // Virtual offset of 1 prevents first-depositor share inflation attack
            let supply = self.erc20.total_supply() + 1;
            let total = self.total_assets_cached.read() + 1;
            assets * supply / total
        }

        fn convert_to_assets(self: @ContractState, shares: u256) -> u256 {
            // Virtual offset of 1 prevents first-depositor share inflation attack
            let supply = self.erc20.total_supply() + 1;
            let total = self.total_assets_cached.read() + 1;
            shares * total / supply
        }

        fn max_deposit(self: @ContractState, receiver: ContractAddress) -> u256 {
            if self.paused.read() {
                return 0;
            }
            let total = self.total_assets_cached.read();
            let cap = self.tvl_cap.read();
            if total >= cap {
                0
            } else {
                let remaining = cap - total;
                if remaining > MAX_DEPOSIT_PER_TX {
                    MAX_DEPOSIT_PER_TX
                } else {
                    remaining
                }
            }
        }

        fn preview_deposit(self: @ContractState, assets: u256) -> u256 {
            self.convert_to_shares(assets)
        }

        fn deposit_assets(
            ref self: ContractState, assets: u256, receiver: ContractAddress
        ) -> u256 {
            self._assert_not_reentered();
            self.reentrancy_status.write('ENTERED');

            assert(!self.paused.read(), 'Vault paused');
            assert(assets >= MIN_DEPOSIT, 'Below min deposit');
            assert(assets <= MAX_DEPOSIT_PER_TX, 'Exceeds max per tx');

            // Enforce TVL cap
            let total_before = self.total_assets_cached.read();
            assert(total_before + assets <= self.tvl_cap.read(), 'TVL cap exceeded');

            let caller = get_caller_address();
            let this = get_contract_address();

            // Transfer moonUSD from caller to vault
            let token = IERC20Dispatcher {
                contract_address: self.moonusd_token.read(),
            };
            token.transfer_from(caller, this, assets);

            // Calculate shares
            let shares = self.convert_to_shares(assets);
            assert(shares > 0, 'Zero shares');

            // Mint vault shares to receiver
            self.erc20.mint(receiver, shares);
            self.total_assets_cached.write(total_before + assets);

            // Deploy capital to adapters based on current weights
            self._deploy_to_adapters(assets);

            self.emit(DepositEvent {
                sender: caller,
                receiver,
                assets,
                shares,
            });

            self.reentrancy_status.write('NOT_ENTERED');
            shares
        }

        fn max_withdraw(self: @ContractState, owner: ContractAddress) -> u256 {
            self.convert_to_assets(self.erc20.balance_of(owner))
        }

        fn preview_withdraw(self: @ContractState, assets: u256) -> u256 {
            self.convert_to_shares(assets)
        }

        fn withdraw_assets(
            ref self: ContractState,
            assets: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) -> u256 {
            self._assert_not_reentered();
            self.reentrancy_status.write('ENTERED');

            assert(assets > 0, 'Zero withdrawal');
            let shares = self.convert_to_shares(assets);
            self._process_withdrawal(shares, assets, receiver, owner);

            self.reentrancy_status.write('NOT_ENTERED');
            shares
        }

        fn max_redeem(self: @ContractState, owner: ContractAddress) -> u256 {
            self.erc20.balance_of(owner)
        }

        fn preview_redeem(self: @ContractState, shares: u256) -> u256 {
            self.convert_to_assets(shares)
        }

        fn redeem(
            ref self: ContractState,
            shares: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) -> u256 {
            self._assert_not_reentered();
            self.reentrancy_status.write('ENTERED');

            assert(shares > 0, 'Zero redeem');
            let assets = self.convert_to_assets(shares);
            self._process_withdrawal(shares, assets, receiver, owner);

            self.reentrancy_status.write('NOT_ENTERED');
            assets
        }

        fn deposit_usdc(
            ref self: ContractState, usdc_amount: u256, receiver: ContractAddress
        ) -> u256 {
            self._assert_not_reentered();
            self.reentrancy_status.write('ENTERED');

            assert(!self.paused.read(), 'Vault paused');
            assert(usdc_amount > 0, 'Zero deposit');

            let caller = get_caller_address();
            let this = get_contract_address();

            // Transfer USDC from caller
            let usdc = IERC20Dispatcher {
                contract_address: self.usdc_token.read(),
            };
            usdc.transfer_from(caller, this, usdc_amount);

            // In production: swap USDC -> moonUSD via Ekubo router
            // For now, treat USDC 1:1 with moonUSD (same USD peg)
            let moonusd_equivalent = usdc_amount;

            let total_before = self.total_assets_cached.read();
            assert(total_before + moonusd_equivalent <= self.tvl_cap.read(), 'TVL cap exceeded');

            let shares = self.convert_to_shares(moonusd_equivalent);
            assert(shares > 0, 'Zero shares');

            self.erc20.mint(receiver, shares);
            self.total_assets_cached.write(total_before + moonusd_equivalent);

            self.emit(DepositEvent {
                sender: caller,
                receiver,
                assets: moonusd_equivalent,
                shares,
            });

            self.reentrancy_status.write('NOT_ENTERED');
            shares
        }

        fn compound(ref self: ContractState) {
            self._assert_not_reentered();
            self.reentrancy_status.write('ENTERED');

            let caller = get_caller_address();
            assert(
                caller == self.keeper.read() || caller == self.ownable.owner(),
                'Not authorized'
            );

            let now = get_block_timestamp();
            let last = self.last_compound_time.read();
            assert(now > last + COMPOUND_INTERVAL || last == 0, 'Too soon');

            // Harvest from all active adapters
            let count = self.adapter_count.read();
            let mut total_yield: u256 = 0;
            let mut i: u256 = 0;
            while i < count {
                let adapter_addr = self.adapters.read(i);
                let adapter = IYieldAdapterDispatcher { contract_address: adapter_addr };
                if adapter.is_active() {
                    let yield_amount = adapter.harvest();
                    total_yield += yield_amount;
                }
                i += 1;
            };

            if total_yield == 0 {
                self.last_compound_time.write(now);
                self.reentrancy_status.write('NOT_ENTERED');
                return;
            }

            // Deduct performance fee
            let fee_bps = self.performance_fee_bps.read();
            let fee = total_yield * fee_bps / BPS;
            let net_yield = total_yield - fee;

            // Send fee to treasury
            if fee > 0 {
                let treasury = self.treasury.read();
                let zero: ContractAddress = starknet::contract_address_const::<0>();
                if treasury != zero {
                    let token = IERC20Dispatcher {
                        contract_address: self.moonusd_token.read(),
                    };
                    token.transfer(treasury, fee);
                }
            }

            // Reinvest net yield — increases share price
            self.total_assets_cached.write(
                self.total_assets_cached.read() + net_yield
            );
            self.cumulative_yield.write(self.cumulative_yield.read() + net_yield);
            self.last_compound_time.write(now);

            self.emit(Compound {
                yield_earned: total_yield,
                fee_taken: fee,
                timestamp: now,
            });

            self.reentrancy_status.write('NOT_ENTERED');
        }

        fn reallocate(ref self: ContractState) {
            self._assert_not_reentered();
            self.reentrancy_status.write('ENTERED');

            let caller = get_caller_address();
            assert(
                caller == self.keeper.read() || caller == self.ownable.owner(),
                'Not authorized'
            );

            let count = self.adapter_count.read();
            if count == 0 {
                self.reentrancy_status.write('NOT_ENTERED');
                return;
            }

            // Collect APYs, mins, maxs from adapters
            let mut apys: Array<u256> = ArrayTrait::new();
            let mut mins: Array<u256> = ArrayTrait::new();
            let mut maxs: Array<u256> = ArrayTrait::new();

            let mut i: u256 = 0;
            while i < count {
                let adapter_addr = self.adapters.read(i);
                let adapter = IYieldAdapterDispatcher { contract_address: adapter_addr };
                let apy = if adapter.is_active() {
                    adapter.get_current_apy_bps()
                } else {
                    0
                };
                apys.append(apy);
                mins.append(self.adapter_min_weight.read(i));
                maxs.append(self.adapter_max_weight.read(i));
                i += 1;
            };

            // Compute softmax weights
            let weights = softmax_allocate(
                apys.span(), GAMMA_BPS, mins.span(), maxs.span()
            );

            // Store new weights
            let mut i: u256 = 0;
            while i < count {
                let w = *weights.at(i.try_into().unwrap());
                self.adapter_current_weight.write(i, w);
                i += 1;
            };

            // Rebalance capital according to new weights
            self._rebalance_adapters();

            self.emit(Reallocate {
                timestamp: get_block_timestamp(),
            });

            self.reentrancy_status.write('NOT_ENTERED');
        }

        fn get_allocation(self: @ContractState) -> (u256, u256, u256) {
            let count = self.adapter_count.read();
            let w0 = if count > 0 { self.adapter_current_weight.read(0) } else { 0 };
            let w1 = if count > 1 { self.adapter_current_weight.read(1) } else { 0 };
            let w2 = if count > 2 { self.adapter_current_weight.read(2) } else { 0 };
            (w0, w1, w2)
        }

        fn get_effective_apy(self: @ContractState) -> u256 {
            let total = self.total_assets_cached.read();
            if total == 0 {
                return 0;
            }
            let cumulative = self.cumulative_yield.read();
            cumulative * BPS / total
        }

        fn get_price_per_share(self: @ContractState) -> u256 {
            let supply = self.erc20.total_supply();
            let total = self.total_assets_cached.read();
            if supply == 0 {
                SCALE
            } else {
                total * SCALE / supply
            }
        }

        fn get_tvl_cap(self: @ContractState) -> u256 {
            self.tvl_cap.read()
        }

        fn get_adapter_count(self: @ContractState) -> u256 {
            self.adapter_count.read()
        }
    }

    // Internal implementation
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_not_reentered(self: @ContractState) {
            assert(self.reentrancy_status.read() != 'ENTERED', 'Reentrant call');
        }

        fn _process_withdrawal(
            ref self: ContractState,
            shares: u256,
            assets: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) {
            let caller = get_caller_address();

            // If caller != owner, check and decrement allowance
            if caller != owner {
                let allowance = self.erc20.allowance(owner, caller);
                assert(allowance >= shares, 'Insufficient allowance');
                self.erc20._approve(owner, caller, allowance - shares);
            }

            let balance = self.erc20.balance_of(owner);
            assert(balance >= shares, 'Insufficient shares');

            // Burn shares
            self.erc20.burn(owner, shares);
            self.total_assets_cached.write(
                self.total_assets_cached.read() - assets
            );

            // Withdraw from adapters (lowest APY first)
            self._withdraw_from_adapters(assets);

            // Transfer moonUSD to receiver
            let token = IERC20Dispatcher {
                contract_address: self.moonusd_token.read(),
            };
            token.transfer(receiver, assets);

            self.emit(WithdrawEvent {
                sender: caller,
                receiver,
                owner,
                assets,
                shares,
            });
        }

        fn _deploy_to_adapters(ref self: ContractState, amount: u256) {
            let count = self.adapter_count.read();
            if count == 0 {
                return;
            }

            let mut remaining = amount;
            let mut i: u256 = 0;
            while i < count {
                let weight = self.adapter_current_weight.read(i);
                let adapter_addr = self.adapters.read(i);
                let adapter = IYieldAdapterDispatcher { contract_address: adapter_addr };

                if adapter.is_active() && weight > 0 {
                    let deploy_amount = if i == count - 1 {
                        // Last adapter gets remainder
                        remaining
                    } else {
                        let portion = amount * weight / BPS;
                        if portion > remaining { remaining } else { portion }
                    };

                    if deploy_amount > 0 {
                        // Approve adapter to pull tokens
                        let token = IERC20Dispatcher {
                            contract_address: self.moonusd_token.read(),
                        };
                        token.approve(adapter_addr, deploy_amount);
                        adapter.deploy(deploy_amount);
                        remaining -= deploy_amount;
                    }
                }
                i += 1;
            };
        }

        fn _withdraw_from_adapters(ref self: ContractState, amount: u256) {
            let count = self.adapter_count.read();
            if count == 0 {
                return;
            }

            // Withdraw from lowest-APY adapter first
            // Simple approach: collect (index, apy) then iterate from lowest
            let mut remaining = amount;

            // First pass: find adapter with lowest APY that has capital
            // Iterate multiple passes until remaining is 0
            let mut passes: u256 = 0;
            while remaining > 0 && passes < count {
                let mut lowest_apy: u256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
                let mut lowest_idx: u256 = 0;
                let mut found = false;

                let mut i: u256 = 0;
                while i < count {
                    let adapter_addr = self.adapters.read(i);
                    let adapter = IYieldAdapterDispatcher { contract_address: adapter_addr };
                    let capital = adapter.get_deployed_capital();
                    if capital > 0 {
                        let apy = adapter.get_current_apy_bps();
                        if apy < lowest_apy {
                            lowest_apy = apy;
                            lowest_idx = i;
                            found = true;
                        }
                    }
                    i += 1;
                };

                if !found {
                    break;
                }

                let adapter_addr = self.adapters.read(lowest_idx);
                let adapter = IYieldAdapterDispatcher { contract_address: adapter_addr };
                let withdrawn = adapter.withdraw(remaining);
                if withdrawn > remaining {
                    remaining = 0;
                } else {
                    remaining -= withdrawn;
                }
                passes += 1;
            };
        }

        fn _rebalance_adapters(ref self: ContractState) {
            let total = self.total_assets_cached.read();
            if total == 0 {
                return;
            }

            let count = self.adapter_count.read();

            // Step 1: Withdraw excess from over-allocated adapters
            let mut i: u256 = 0;
            while i < count {
                let target = total * self.adapter_current_weight.read(i) / BPS;
                let adapter_addr = self.adapters.read(i);
                let adapter = IYieldAdapterDispatcher { contract_address: adapter_addr };
                let current = adapter.get_deployed_capital();

                if current > target {
                    let excess = current - target;
                    adapter.withdraw(excess);
                }
                i += 1;
            };

            // Step 2: Deploy to under-allocated adapters
            let mut i: u256 = 0;
            while i < count {
                let target = total * self.adapter_current_weight.read(i) / BPS;
                let adapter_addr = self.adapters.read(i);
                let adapter = IYieldAdapterDispatcher { contract_address: adapter_addr };
                let current = adapter.get_deployed_capital();

                if current < target && adapter.is_active() {
                    let deficit = target - current;
                    let token = IERC20Dispatcher {
                        contract_address: self.moonusd_token.read(),
                    };
                    token.approve(adapter_addr, deficit);
                    adapter.deploy(deficit);
                }
                i += 1;
            };
        }
    }

    // Admin functions
    #[external(v0)]
    fn add_adapter(
        ref self: ContractState,
        adapter: ContractAddress,
        min_weight_bps: u256,
        max_weight_bps: u256,
        initial_weight_bps: u256,
    ) {
        self.ownable.assert_only_owner();
        assert(min_weight_bps <= max_weight_bps, 'Invalid weight bounds');
        assert(initial_weight_bps >= min_weight_bps, 'Below min weight');
        assert(initial_weight_bps <= max_weight_bps, 'Above max weight');

        let idx = self.adapter_count.read();
        self.adapters.write(idx, adapter);
        self.adapter_min_weight.write(idx, min_weight_bps);
        self.adapter_max_weight.write(idx, max_weight_bps);
        self.adapter_current_weight.write(idx, initial_weight_bps);
        self.adapter_count.write(idx + 1);

        self.emit(AdapterAdded { index: idx, adapter });
    }

    #[external(v0)]
    fn set_keeper(ref self: ContractState, keeper: ContractAddress) {
        self.ownable.assert_only_owner();
        self.keeper.write(keeper);
    }

    #[external(v0)]
    fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
        self.ownable.assert_only_owner();
        self.treasury.write(treasury);
    }

    #[external(v0)]
    fn set_tvl_cap(ref self: ContractState, cap: u256) {
        self.ownable.assert_only_owner();
        self.tvl_cap.write(cap);
    }

    #[external(v0)]
    fn set_performance_fee(ref self: ContractState, fee_bps: u256) {
        self.ownable.assert_only_owner();
        assert(fee_bps <= 3000, 'Fee too high'); // Max 30%
        self.performance_fee_bps.write(fee_bps);
    }

    #[external(v0)]
    fn set_paused(ref self: ContractState, paused: bool) {
        self.ownable.assert_only_owner();
        self.paused.write(paused);
    }
}
