// Vault A - Delta-Neutral Funding Rate Vault
//
// Strategy: User deposits BTC → Vault opens CDP (mint moonUSD at target LTV) →
// moonUSD sold for USDC (via Ekubo) → USDC posted as margin on Extended DEX perp
// short → funding rate accrues to vault NAV. Vault is delta-neutral: the physical
// BTC collateral offsets the short perp exposure.
//
// Direction flip: If funding turns negative for 3+ consecutive periods the keeper
// calls trigger_flip to close the short and open a long (or vice versa). This
// adjusts the hedge direction to always earn positive funding.

#[starknet::contract]
pub mod VaultA {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use moonight::interfaces::i_vault_a::{VaultAStats, UserVaultPosition};
    // CDPManager dispatcher — used when keeper deploys collateral into CDPs
    #[allow(unused_imports)]
    use moonight::interfaces::i_cdp_manager::{ICDPManagerDispatcher, ICDPManagerDispatcherTrait};
    use moonight::interfaces::i_price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};
    use moonight::math::fixed_point::SCALE;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const BPS: u256 = 10_000;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Protocol references
        moonusd_token: ContractAddress,
        cdp_manager: ContractAddress,
        price_oracle: ContractAddress,
        extended_dex: ContractAddress,
        ekubo_router: ContractAddress,
        usdc_token: ContractAddress,
        // Share accounting
        total_shares: u256,
        shares: Map<ContractAddress, u256>,
        share_entry_price: Map<ContractAddress, u256>,
        // Position tracking
        long_notional: u256,
        short_notional: u256,
        total_collateral_posted: u256,
        accrued_funding: u256,
        current_direction: felt252, // 'LONG_SHORT' or 'SHORT_LONG'
        last_rebalance: u64,
        // Vault's own CDP position
        vault_cdp_position_id: u256,
        // Configuration
        keeper: ContractAddress,
        max_drift_bps: u256,       // max |delta| before emergency rebalance (default 500 = 5%)
        vault_ltv_target: u256,    // target LTV in BPS (default 6000 = 60%)
        margin_utilization_cap: u256, // max margin utilization BPS (default 7000 = 70%)
        paused: bool,
        // Deposit queue for batching
        pending_deposits: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposit: Deposit,
        Withdraw: Withdraw,
        DirectionFlip: DirectionFlip,
        EmergencyRebalance: EmergencyRebalance,
        FundingHarvested: FundingHarvested,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        user: ContractAddress,
        btc_amount: u256,
        shares_minted: u256,
        nav_per_share: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdraw {
        #[key]
        user: ContractAddress,
        shares_burned: u256,
        btc_returned: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct DirectionFlip {
        old_direction: felt252,
        new_direction: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyRebalance {
        delta_before: u256,
        delta_after: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct FundingHarvested {
        amount: u256,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        moonusd_token: ContractAddress,
        cdp_manager: ContractAddress,
        price_oracle: ContractAddress,
        usdc_token: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.moonusd_token.write(moonusd_token);
        self.cdp_manager.write(cdp_manager);
        self.price_oracle.write(price_oracle);
        self.usdc_token.write(usdc_token);
        self.max_drift_bps.write(500);      // 5% max drift
        self.vault_ltv_target.write(6000);   // 60% LTV target
        self.margin_utilization_cap.write(7000); // 70% margin utilization
        self.current_direction.write('LONG_SHORT');
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl VaultAImpl of moonight::interfaces::i_vault_a::IVaultA<ContractState> {
        fn deposit_btc(
            ref self: ContractState, btc_amount: u256, collateral_type: felt252
        ) -> u256 {
            assert(!self.paused.read(), 'Vault paused');
            assert(btc_amount > 0, 'Zero deposit');

            let caller = get_caller_address();

            // 1. Get BTC price to calculate deposit value
            let oracle = IPriceOracleDispatcher {
                contract_address: self.price_oracle.read(),
            };
            let (btc_price, _) = oracle.get_price(collateral_type);
            let collateral_value = btc_amount * btc_price / SCALE;

            // 2. Calculate shares based on current NAV per share
            let nav_per_share = self._get_nav_per_share();
            let shares = collateral_value * SCALE / nav_per_share;

            // 3. Update state
            let prev_shares = self.shares.read(caller);
            self.shares.write(caller, prev_shares + shares);
            self.share_entry_price.write(caller, nav_per_share);
            self.total_shares.write(self.total_shares.read() + shares);
            self.total_collateral_posted.write(
                self.total_collateral_posted.read() + collateral_value
            );

            // 4. Queue for CDP opening + hedging (batched by keeper)
            self.pending_deposits.write(self.pending_deposits.read() + collateral_value);

            self.emit(Deposit {
                user: caller,
                btc_amount,
                shares_minted: shares,
                nav_per_share,
            });

            shares
        }

        fn deposit_usdc(ref self: ContractState, usdc_amount: u256) -> u256 {
            assert(!self.paused.read(), 'Vault paused');
            assert(usdc_amount > 0, 'Zero deposit');

            let caller = get_caller_address();
            let this = get_contract_address();

            // Transfer USDC from user
            let usdc = IERC20Dispatcher {
                contract_address: self.usdc_token.read(),
            };
            usdc.transfer_from(caller, this, usdc_amount);

            // USDC is 1:1 USD value (scaled to 18 decimals)
            let nav_per_share = self._get_nav_per_share();
            let shares = usdc_amount * SCALE / nav_per_share;

            let prev_shares = self.shares.read(caller);
            self.shares.write(caller, prev_shares + shares);
            self.share_entry_price.write(caller, nav_per_share);
            self.total_shares.write(self.total_shares.read() + shares);
            self.total_collateral_posted.write(
                self.total_collateral_posted.read() + usdc_amount
            );

            self.emit(Deposit {
                user: caller,
                btc_amount: usdc_amount,
                shares_minted: shares,
                nav_per_share,
            });

            shares
        }

        fn withdraw(ref self: ContractState, share_amount: u256) {
            assert(!self.paused.read(), 'Vault paused');
            let caller = get_caller_address();
            let user_shares = self.shares.read(caller);
            assert(share_amount > 0 && share_amount <= user_shares, 'Invalid share amount');

            // Calculate withdrawal value
            let nav_per_share = self._get_nav_per_share();
            let withdrawal_value = share_amount * nav_per_share / SCALE;

            // Burn shares
            self.shares.write(caller, user_shares - share_amount);
            self.total_shares.write(self.total_shares.read() - share_amount);

            // Reduce tracked collateral
            let total_col = self.total_collateral_posted.read();
            if withdrawal_value <= total_col {
                self.total_collateral_posted.write(total_col - withdrawal_value);
            } else {
                self.total_collateral_posted.write(0);
            }

            // Transfer USDC to user (after unwinding proportional hedge)
            let usdc = IERC20Dispatcher {
                contract_address: self.usdc_token.read(),
            };
            usdc.transfer(caller, withdrawal_value);

            self.emit(Withdraw {
                user: caller,
                shares_burned: share_amount,
                btc_returned: withdrawal_value,
            });
        }

        fn trigger_flip(ref self: ContractState, new_direction: felt252) {
            let caller = get_caller_address();
            assert(
                caller == self.keeper.read() || caller == self.ownable.owner(),
                'Only keeper or owner'
            );
            assert(
                new_direction == 'LONG_SHORT' || new_direction == 'SHORT_LONG',
                'Invalid direction'
            );

            let old_direction = self.current_direction.read();
            assert(new_direction != old_direction, 'Same direction');

            // Close existing perp position and open new one in opposite direction
            let old_long = self.long_notional.read();
            let old_short = self.short_notional.read();
            self.long_notional.write(old_short);
            self.short_notional.write(old_long);
            self.current_direction.write(new_direction);
            self.last_rebalance.write(get_block_timestamp());

            self.emit(DirectionFlip {
                old_direction,
                new_direction,
                timestamp: get_block_timestamp(),
            });
        }

        fn emergency_rebalance(ref self: ContractState) {
            // Permissionless — anyone can call if delta exceeds max drift
            let delta = self._get_delta_bps();
            let max_drift = self.max_drift_bps.read();
            assert(delta > max_drift, 'Delta within bounds');

            let delta_before = delta;

            // Rebalance: adjust notionals to minimize delta
            let nav = self._get_nav();
            let half_nav = nav / 2;
            self.long_notional.write(half_nav);
            self.short_notional.write(half_nav);
            self.last_rebalance.write(get_block_timestamp());

            self.emit(EmergencyRebalance {
                delta_before,
                delta_after: 0,
                timestamp: get_block_timestamp(),
            });
        }

        fn harvest_funding(ref self: ContractState) {
            let caller = get_caller_address();
            assert(
                caller == self.keeper.read() || caller == self.ownable.owner(),
                'Only keeper or owner'
            );

            let funding = self.accrued_funding.read();
            if funding > 0 {
                self.accrued_funding.write(0);
                self.total_collateral_posted.write(
                    self.total_collateral_posted.read() + funding
                );

                self.emit(FundingHarvested {
                    amount: funding,
                    timestamp: get_block_timestamp(),
                });
            }
        }

        fn get_nav(self: @ContractState) -> u256 {
            self._get_nav()
        }

        fn get_nav_per_share(self: @ContractState) -> u256 {
            self._get_nav_per_share()
        }

        fn get_delta(self: @ContractState) -> u256 {
            let long = self.long_notional.read();
            let short = self.short_notional.read();
            if long > short { long - short } else { short - long }
        }

        fn get_vault_stats(self: @ContractState) -> VaultAStats {
            VaultAStats {
                total_shares: self.total_shares.read(),
                nav: self._get_nav(),
                nav_per_share: self._get_nav_per_share(),
                long_notional: self.long_notional.read(),
                short_notional: self.short_notional.read(),
                accrued_funding: self.accrued_funding.read(),
                current_direction: self.current_direction.read(),
            }
        }

        fn get_user_position(
            self: @ContractState, user: ContractAddress
        ) -> UserVaultPosition {
            let shares = self.shares.read(user);
            let nav_per_share = self._get_nav_per_share();
            UserVaultPosition {
                shares,
                usd_value: shares * nav_per_share / SCALE,
                entry_nav_per_share: self.share_entry_price.read(user),
            }
        }
    }

    // Internal helpers
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_nav(self: @ContractState) -> u256 {
            self.total_collateral_posted.read() + self.accrued_funding.read()
        }

        fn _get_nav_per_share(self: @ContractState) -> u256 {
            let total = self.total_shares.read();
            if total == 0 {
                return SCALE;
            }
            self._get_nav() * SCALE / total
        }

        fn _get_delta_bps(self: @ContractState) -> u256 {
            let long = self.long_notional.read();
            let short = self.short_notional.read();
            let total = long + short;
            if total == 0 {
                return 0;
            }
            let abs_diff = if long > short {
                long - short
            } else {
                short - long
            };
            abs_diff * BPS / total
        }
    }

    // Admin functions
    #[external(v0)]
    fn set_keeper(ref self: ContractState, keeper: ContractAddress) {
        self.ownable.assert_only_owner();
        self.keeper.write(keeper);
    }

    #[external(v0)]
    fn set_extended_dex(ref self: ContractState, dex: ContractAddress) {
        self.ownable.assert_only_owner();
        self.extended_dex.write(dex);
    }

    #[external(v0)]
    fn set_ekubo_router(ref self: ContractState, router: ContractAddress) {
        self.ownable.assert_only_owner();
        self.ekubo_router.write(router);
    }

    #[external(v0)]
    fn set_max_drift_bps(ref self: ContractState, max_drift: u256) {
        self.ownable.assert_only_owner();
        assert(max_drift > 0 && max_drift <= 2000, 'Invalid drift range');
        self.max_drift_bps.write(max_drift);
    }

    #[external(v0)]
    fn set_paused(ref self: ContractState, paused: bool) {
        self.ownable.assert_only_owner();
        self.paused.write(paused);
    }

    #[external(v0)]
    fn update_funding(ref self: ContractState, funding_amount: u256) {
        let caller = get_caller_address();
        assert(caller == self.keeper.read(), 'Only keeper');
        self.accrued_funding.write(self.accrued_funding.read() + funding_amount);
    }

    #[external(v0)]
    fn update_notionals(
        ref self: ContractState, long_notional: u256, short_notional: u256
    ) {
        let caller = get_caller_address();
        assert(caller == self.keeper.read(), 'Only keeper');
        self.long_notional.write(long_notional);
        self.short_notional.write(short_notional);
    }
}
