// Vault C - Yield Optimizer (vmoonUSD, ERC-4626 compliant)
//
// Accepts moonUSD deposits and allocates across yield sources:
//   - Stability Pool (56% default) — earns liquidation proceeds + interest share
//   - Ekubo LP (29% default)       — earns LP fees on moonUSD/USDC pair
//   - LayerZero bridge (15%)       — earns bridge fee share (disabled initially)
//
// The vault mints vmoonUSD (vault shares) 1:1 initially, with price-per-share
// increasing as yield compounds. A 15% performance fee is deducted on compound
// and sent to the treasury.

#[starknet::contract]
pub mod VaultC {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use moonight::interfaces::i_stability_pool::{IStabilityPoolDispatcher, IStabilityPoolDispatcherTrait};
    use moonight::math::fixed_point::SCALE;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const BPS: u256 = 10_000;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        moonusd_token: ContractAddress,
        usdc_token: ContractAddress,
        stability_pool: ContractAddress,
        ekubo_router: ContractAddress,
        // Allocation weights (BPS, must sum to 10000)
        weight_sp: u256,
        weight_ekubo: u256,
        weight_lz: u256,
        // Capital deployed per source
        capital_in_sp: u256,
        capital_in_ekubo: u256,
        capital_in_lz: u256,
        // Total assets under management
        total_assets_cached: u256,
        // Yield tracking
        last_compound_time: u64,
        cumulative_yield: u256,
        // Fees
        performance_fee_bps: u256,
        treasury: ContractAddress,
        // Access control
        keeper: ContractAddress,
        paused: bool,
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
        new_sp: u256,
        new_ekubo: u256,
        new_lz: u256,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        moonusd_token: ContractAddress,
        usdc_token: ContractAddress,
        stability_pool: ContractAddress,
    ) {
        self.erc20.initializer("vmoonUSD", "vmUSD");
        self.ownable.initializer(owner);
        self.moonusd_token.write(moonusd_token);
        self.usdc_token.write(usdc_token);
        self.stability_pool.write(stability_pool);
        // Default allocation: 56% SP, 29% Ekubo, 15% LZ
        self.weight_sp.write(5600);
        self.weight_ekubo.write(2900);
        self.weight_lz.write(1500);
        self.performance_fee_bps.write(1500); // 15% perf fee
        self.paused.write(false);
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
            let supply = self.erc20.total_supply();
            let total = self.total_assets_cached.read();
            if supply == 0 || total == 0 {
                assets
            } else {
                assets * supply / total
            }
        }

        fn convert_to_assets(self: @ContractState, shares: u256) -> u256 {
            let supply = self.erc20.total_supply();
            let total = self.total_assets_cached.read();
            if supply == 0 {
                shares
            } else {
                shares * total / supply
            }
        }

        fn max_deposit(self: @ContractState, receiver: ContractAddress) -> u256 {
            if self.paused.read() {
                0
            } else {
                0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF_u256
            }
        }

        fn preview_deposit(self: @ContractState, assets: u256) -> u256 {
            self.convert_to_shares(assets)
        }

        fn deposit_assets(
            ref self: ContractState, assets: u256, receiver: ContractAddress
        ) -> u256 {
            assert(!self.paused.read(), 'Vault paused');
            assert(assets > 0, 'Zero deposit');

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
            self.total_assets_cached.write(self.total_assets_cached.read() + assets);

            // Deploy capital to Stability Pool (primary allocation)
            self._deploy_to_sp(assets);

            self.emit(DepositEvent {
                sender: caller,
                receiver,
                assets,
                shares,
            });

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
            assert(assets > 0, 'Zero withdrawal');
            let shares = self.convert_to_shares(assets);
            self._process_withdrawal(shares, assets, receiver, owner);
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
            assert(shares > 0, 'Zero redeem');
            let assets = self.convert_to_assets(shares);
            self._process_withdrawal(shares, assets, receiver, owner);
            assets
        }

        fn deposit_usdc(
            ref self: ContractState, usdc_amount: u256, receiver: ContractAddress
        ) -> u256 {
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

            let shares = self.convert_to_shares(moonusd_equivalent);
            assert(shares > 0, 'Zero shares');

            self.erc20.mint(receiver, shares);
            self.total_assets_cached.write(
                self.total_assets_cached.read() + moonusd_equivalent
            );

            self.emit(DepositEvent {
                sender: caller,
                receiver,
                assets: moonusd_equivalent,
                shares,
            });

            shares
        }

        fn compound(ref self: ContractState) {
            let caller = get_caller_address();
            assert(
                caller == self.keeper.read() || caller == self.ownable.owner(),
                'Not authorized'
            );

            let now = get_block_timestamp();
            let last = self.last_compound_time.read();
            // Minimum 1 hour between compounds
            assert(now > last + 3600 || last == 0, 'Too soon');

            // 1. Harvest from Stability Pool
            let sp_yield = self._harvest_sp_yield();

            // 2. Harvest from Ekubo LP (placeholder)
            let ekubo_yield = self._harvest_ekubo_yield();

            // 3. LayerZero yield (placeholder)
            let lz_yield: u256 = 0;

            let total_yield = sp_yield + ekubo_yield + lz_yield;
            if total_yield == 0 {
                self.last_compound_time.write(now);
                return;
            }

            // 4. Deduct performance fee
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

            // 5. Reinvest net yield — increases share price
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
        }

        fn reallocate(ref self: ContractState, new_weights: Array<u256>) {
            let caller = get_caller_address();
            assert(
                caller == self.keeper.read() || caller == self.ownable.owner(),
                'Not authorized'
            );
            assert(new_weights.len() == 3, 'Need 3 weights');

            let w_sp = *new_weights.at(0);
            let w_ekubo = *new_weights.at(1);
            let w_lz = *new_weights.at(2);

            // Validate weights sum to 10000 BPS
            assert(w_sp + w_ekubo + w_lz == BPS, 'Weights must sum to 10000');

            // Stability Pool must remain >= 30% for protocol safety
            assert(w_sp >= 3000, 'SP weight min 30%');

            self.weight_sp.write(w_sp);
            self.weight_ekubo.write(w_ekubo);
            self.weight_lz.write(w_lz);

            // Rebalance capital according to new weights
            self._rebalance_capital();

            self.emit(Reallocate {
                new_sp: w_sp,
                new_ekubo: w_ekubo,
                new_lz: w_lz,
                timestamp: get_block_timestamp(),
            });
        }

        fn get_allocation(self: @ContractState) -> (u256, u256, u256) {
            (
                self.weight_sp.read(),
                self.weight_ekubo.read(),
                self.weight_lz.read(),
            )
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
    }

    // Internal implementation
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _process_withdrawal(
            ref self: ContractState,
            shares: u256,
            assets: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) {
            let caller = get_caller_address();

            // If caller != owner, check allowance
            if caller != owner {
                let allowance = self.erc20.allowance(owner, caller);
                assert(allowance >= shares, 'Insufficient allowance');
            }

            let balance = self.erc20.balance_of(owner);
            assert(balance >= shares, 'Insufficient shares');

            // Burn shares
            self.erc20.burn(owner, shares);
            self.total_assets_cached.write(
                self.total_assets_cached.read() - assets
            );

            // Withdraw capital from SP first (most liquid)
            self._withdraw_from_sp(assets);

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

        fn _deploy_to_sp(ref self: ContractState, amount: u256) {
            let sp_addr = self.stability_pool.read();
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            if sp_addr == zero {
                return;
            }

            // Approve SP to spend moonUSD
            let token = IERC20Dispatcher {
                contract_address: self.moonusd_token.read(),
            };
            token.approve(sp_addr, amount);

            // Deposit into Stability Pool
            let sp = IStabilityPoolDispatcher { contract_address: sp_addr };
            sp.deposit(amount);

            self.capital_in_sp.write(self.capital_in_sp.read() + amount);
        }

        fn _withdraw_from_sp(ref self: ContractState, amount: u256) {
            let sp_addr = self.stability_pool.read();
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            if sp_addr == zero {
                return;
            }

            let capital = self.capital_in_sp.read();
            let withdraw_amount = if amount <= capital { amount } else { capital };

            if withdraw_amount > 0 {
                let sp = IStabilityPoolDispatcher { contract_address: sp_addr };
                sp.withdraw(withdraw_amount);
                self.capital_in_sp.write(capital - withdraw_amount);
            }
        }

        fn _harvest_sp_yield(ref self: ContractState) -> u256 {
            let sp_addr = self.stability_pool.read();
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            if sp_addr == zero {
                return 0;
            }

            let sp = IStabilityPoolDispatcher { contract_address: sp_addr };

            // Claim interest yield from SP
            sp.claim_interest_yield();

            // Check balance delta to determine yield earned
            let token = IERC20Dispatcher {
                contract_address: self.moonusd_token.read(),
            };
            let balance = token.balance_of(get_contract_address());
            let expected = self.total_assets_cached.read();

            if balance > expected {
                balance - expected
            } else {
                0
            }
        }

        fn _harvest_ekubo_yield(ref self: ContractState) -> u256 {
            // Placeholder: will call Ekubo router to collect LP fees
            0
        }

        fn _rebalance_capital(ref self: ContractState) {
            let total = self.total_assets_cached.read();
            if total == 0 {
                return;
            }

            let target_sp = total * self.weight_sp.read() / BPS;
            let target_ekubo = total * self.weight_ekubo.read() / BPS;
            let target_lz = total * self.weight_lz.read() / BPS;

            let current_sp = self.capital_in_sp.read();

            // Rebalance SP allocation
            if target_sp > current_sp {
                let deploy = target_sp - current_sp;
                self._deploy_to_sp(deploy);
            } else if current_sp > target_sp {
                let remove = current_sp - target_sp;
                self._withdraw_from_sp(remove);
            }

            // Update tracked capital (Ekubo/LZ are placeholders)
            self.capital_in_ekubo.write(target_ekubo);
            self.capital_in_lz.write(target_lz);
        }
    }

    // Admin functions
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
    fn set_ekubo_router(ref self: ContractState, router: ContractAddress) {
        self.ownable.assert_only_owner();
        self.ekubo_router.write(router);
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
