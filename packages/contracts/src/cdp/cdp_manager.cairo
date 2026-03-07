// CDP Manager - Core CDP engine (Phase 2 full implementation)
// Manages positions: open, close, deposit, withdraw, mint, repay, liquidate

#[starknet::contract]
pub mod CDPManager {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use moonight::interfaces::i_cdp_manager::PositionData;
    use moonight::interfaces::i_moonusd::{IMoonUSDDispatcher, IMoonUSDDispatcherTrait};
    use moonight::interfaces::i_position_nft::{IPositionNFTDispatcher, IPositionNFTDispatcherTrait};
    use moonight::interfaces::i_price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};
    use moonight::interfaces::i_stability_pool::{IStabilityPoolDispatcher, IStabilityPoolDispatcherTrait};
    use moonight::interfaces::i_redemption_manager::{IRedemptionManagerDispatcher, IRedemptionManagerDispatcherTrait};
    use moonight::cdp::interest;
    use moonight::math::fixed_point::{SCALE, BPS_SCALE};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // External contract references
        moonusd_token: ContractAddress,
        position_nft: ContractAddress,
        price_oracle: ContractAddress,
        stability_pool: ContractAddress,
        redemption_manager: ContractAddress,
        protocol_config: ContractAddress,
        treasury: ContractAddress,
        // Position data maps
        position_collateral_type: Map<u256, felt252>,
        position_collateral_amount: Map<u256, u256>,
        position_debt: Map<u256, u256>,
        position_interest_rate: Map<u256, u256>,
        position_last_update: Map<u256, u64>,
        position_created_at: Map<u256, u64>,
        position_rate_cooldown: Map<u256, u64>,
        position_active: Map<u256, bool>,
        // Collateral config
        collateral_token: Map<felt252, ContractAddress>,
        collateral_ltv_max: Map<felt252, u256>,
        collateral_liq_penalty: Map<felt252, u256>,
        collateral_decimals: Map<felt252, u8>,
        collateral_enabled: Map<felt252, bool>,
        // Global aggregates
        total_debt: u256,
        weighted_rate_sum: u256,
        next_position_id: u256,
        active_position_count: u256,
        // Pause state
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        PositionOpened: PositionOpened,
        PositionClosed: PositionClosed,
        CollateralDeposited: CollateralDeposited,
        CollateralWithdrawn: CollateralWithdrawn,
        DebtMinted: DebtMinted,
        DebtRepaid: DebtRepaid,
        RateChanged: RateChanged,
        PositionLiquidated: PositionLiquidated,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionOpened {
        #[key]
        position_id: u256,
        #[key]
        owner: ContractAddress,
        collateral_type: felt252,
        collateral_amount: u256,
        debt: u256,
        rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionClosed {
        #[key]
        position_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct CollateralDeposited {
        #[key]
        position_id: u256,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct CollateralWithdrawn {
        #[key]
        position_id: u256,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct DebtMinted {
        #[key]
        position_id: u256,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct DebtRepaid {
        #[key]
        position_id: u256,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct RateChanged {
        #[key]
        position_id: u256,
        old_rate: u256,
        new_rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionLiquidated {
        #[key]
        position_id: u256,
        debt_absorbed: u256,
        collateral_distributed: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        moonusd_token: ContractAddress,
        position_nft: ContractAddress,
        price_oracle: ContractAddress,
        stability_pool: ContractAddress,
        redemption_manager: ContractAddress,
        protocol_config: ContractAddress,
        treasury: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.moonusd_token.write(moonusd_token);
        self.position_nft.write(position_nft);
        self.price_oracle.write(price_oracle);
        self.stability_pool.write(stability_pool);
        self.redemption_manager.write(redemption_manager);
        self.protocol_config.write(protocol_config);
        self.treasury.write(treasury);
        self.next_position_id.write(1);
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl CDPManagerImpl of moonight::interfaces::i_cdp_manager::ICDPManager<ContractState> {
        fn open_position(
            ref self: ContractState,
            collateral_type: felt252,
            collateral_amount: u256,
            mint_amount: u256,
            interest_rate: u256,
        ) -> u256 {
            // Assert not paused
            assert(!self.paused.read(), 'Protocol is paused');
            // Assert collateral enabled
            assert(self.collateral_enabled.read(collateral_type), 'Collateral not enabled');

            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Get oracle price
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (price, _) = oracle.get_price_twap(collateral_type);

            // Calculate collateral value
            let decimals = self.collateral_decimals.read(collateral_type);
            let collateral_value = interest::calculate_collateral_value(collateral_amount, price, decimals);

            // Validate minimum debt (200 moonUSD = 200 * 10^18)
            let min_debt: u256 = 200 * SCALE;
            assert(mint_amount >= min_debt, 'Below minimum debt');

            // Validate LTV
            let ltv_max = self.collateral_ltv_max.read(collateral_type);
            let ltv = mint_amount * BPS_SCALE / collateral_value;
            assert(ltv <= ltv_max, 'Exceeds max LTV');

            // Validate interest rate (0.5% to 500% = 50 to 50000 bps)
            assert(interest_rate >= 50, 'Rate below minimum');
            assert(interest_rate <= 50000, 'Rate above maximum');

            // Calculate borrow fee
            let market_rate = self._get_market_average_rate();
            let borrow_fee = interest::calculate_borrow_fee(mint_amount, market_rate, 7);
            let total_debt = mint_amount + borrow_fee;

            // Transfer collateral from caller
            let collateral_token_addr = self.collateral_token.read(collateral_type);
            let collateral_token = IERC20Dispatcher { contract_address: collateral_token_addr };
            collateral_token.transfer_from(caller, starknet::get_contract_address(), collateral_amount);

            // Mint position NFT
            let nft = IPositionNFTDispatcher { contract_address: self.position_nft.read() };
            let position_id = nft.mint(caller);

            // Store position data
            self.position_collateral_type.write(position_id, collateral_type);
            self.position_collateral_amount.write(position_id, collateral_amount);
            self.position_debt.write(position_id, total_debt);
            self.position_interest_rate.write(position_id, interest_rate);
            self.position_last_update.write(position_id, timestamp);
            self.position_created_at.write(position_id, timestamp);
            self.position_active.write(position_id, true);

            // Mint moonUSD to caller
            let moonusd = IMoonUSDDispatcher { contract_address: self.moonusd_token.read() };
            moonusd.mint(caller, mint_amount);

            // Distribute borrow fee: 75% to SP, 25% to treasury
            if borrow_fee > 0 {
                let sp_share = borrow_fee * 75 / 100;
                let treasury_share = borrow_fee - sp_share;
                moonusd.mint(self.stability_pool.read(), sp_share);
                moonusd.mint(self.treasury.read(), treasury_share);
            }

            // Update global aggregates
            self.total_debt.write(self.total_debt.read() + total_debt);
            self.weighted_rate_sum.write(
                self.weighted_rate_sum.read() + total_debt * interest_rate
            );
            self.active_position_count.write(self.active_position_count.read() + 1);

            // Insert into redemption sorted list
            let redemption_mgr = IRedemptionManagerDispatcher { contract_address: self.redemption_manager.read() };
            redemption_mgr.insert(position_id, interest_rate);

            self.emit(PositionOpened {
                position_id, owner: caller, collateral_type,
                collateral_amount, debt: total_debt, rate: interest_rate,
            });

            position_id
        }

        fn close_position(ref self: ContractState, position_id: u256) {
            self._assert_position_owner(position_id);
            assert(self.position_active.read(position_id), 'Position not active');

            let caller = get_caller_address();

            // Accrue interest
            self._accrue_interest(position_id);
            let debt = self.position_debt.read(position_id);
            let collateral_amount = self.position_collateral_amount.read(position_id);
            let collateral_type = self.position_collateral_type.read(position_id);
            let rate = self.position_interest_rate.read(position_id);

            // Burn moonUSD to repay full debt
            let moonusd = IMoonUSDDispatcher { contract_address: self.moonusd_token.read() };
            moonusd.burn(caller, debt);

            // Return collateral
            let collateral_token_addr = self.collateral_token.read(collateral_type);
            let collateral_token = IERC20Dispatcher { contract_address: collateral_token_addr };
            collateral_token.transfer(caller, collateral_amount);

            // Burn NFT
            let nft = IPositionNFTDispatcher { contract_address: self.position_nft.read() };
            nft.burn(position_id);

            // Update globals
            self.total_debt.write(self.total_debt.read() - debt);
            self.weighted_rate_sum.write(self.weighted_rate_sum.read() - debt * rate);
            self.active_position_count.write(self.active_position_count.read() - 1);
            self.position_active.write(position_id, false);

            // Remove from redemption queue
            let redemption_mgr = IRedemptionManagerDispatcher { contract_address: self.redemption_manager.read() };
            redemption_mgr.remove(position_id);

            self.emit(PositionClosed { position_id });
        }

        fn deposit_collateral(ref self: ContractState, position_id: u256, amount: u256) {
            self._assert_position_owner(position_id);
            assert(self.position_active.read(position_id), 'Position not active');

            let caller = get_caller_address();
            let collateral_type = self.position_collateral_type.read(position_id);
            let collateral_token_addr = self.collateral_token.read(collateral_type);
            let collateral_token = IERC20Dispatcher { contract_address: collateral_token_addr };
            collateral_token.transfer_from(caller, starknet::get_contract_address(), amount);

            let current = self.position_collateral_amount.read(position_id);
            self.position_collateral_amount.write(position_id, current + amount);

            self.emit(CollateralDeposited { position_id, amount });
        }

        fn withdraw_collateral(ref self: ContractState, position_id: u256, amount: u256) {
            self._assert_position_owner(position_id);
            assert(self.position_active.read(position_id), 'Position not active');

            self._accrue_interest(position_id);

            let current = self.position_collateral_amount.read(position_id);
            assert(amount <= current, 'Insufficient collateral');

            let new_collateral = current - amount;
            self.position_collateral_amount.write(position_id, new_collateral);

            // Validate HF >= 1.1 after withdrawal
            let hf = self._calculate_hf(position_id);
            let min_hf = SCALE * 11 / 10; // 1.1
            assert(hf >= min_hf, 'HF too low after withdrawal');

            let caller = get_caller_address();
            let collateral_type = self.position_collateral_type.read(position_id);
            let collateral_token_addr = self.collateral_token.read(collateral_type);
            let collateral_token = IERC20Dispatcher { contract_address: collateral_token_addr };
            collateral_token.transfer(caller, amount);

            self.emit(CollateralWithdrawn { position_id, amount });
        }

        fn mint_more(ref self: ContractState, position_id: u256, amount: u256) {
            self._assert_position_owner(position_id);
            assert(self.position_active.read(position_id), 'Position not active');
            assert(!self.paused.read(), 'Protocol is paused');

            self._accrue_interest(position_id);

            let caller = get_caller_address();
            let collateral_type = self.position_collateral_type.read(position_id);
            let rate = self.position_interest_rate.read(position_id);

            // Calculate borrow fee on new amount
            let market_rate = self._get_market_average_rate();
            let borrow_fee = interest::calculate_borrow_fee(amount, market_rate, 7);

            let current_debt = self.position_debt.read(position_id);
            let new_debt = current_debt + amount + borrow_fee;
            self.position_debt.write(position_id, new_debt);

            // Validate LTV
            let collateral_amount = self.position_collateral_amount.read(position_id);
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (price, _) = oracle.get_price_twap(collateral_type);
            let decimals = self.collateral_decimals.read(collateral_type);
            let collateral_value = interest::calculate_collateral_value(collateral_amount, price, decimals);
            let ltv_max = self.collateral_ltv_max.read(collateral_type);
            let ltv = new_debt * BPS_SCALE / collateral_value;
            assert(ltv <= ltv_max, 'Exceeds max LTV');

            // Mint
            let moonusd = IMoonUSDDispatcher { contract_address: self.moonusd_token.read() };
            moonusd.mint(caller, amount);

            // Distribute fee
            if borrow_fee > 0 {
                let sp_share = borrow_fee * 75 / 100;
                let treasury_share = borrow_fee - sp_share;
                moonusd.mint(self.stability_pool.read(), sp_share);
                moonusd.mint(self.treasury.read(), treasury_share);
            }

            // Update globals
            self.total_debt.write(self.total_debt.read() + amount + borrow_fee);
            self.weighted_rate_sum.write(
                self.weighted_rate_sum.read() + (amount + borrow_fee) * rate
            );

            self.emit(DebtMinted { position_id, amount });
        }

        fn repay(ref self: ContractState, position_id: u256, amount: u256) {
            assert(self.position_active.read(position_id), 'Position not active');
            self._accrue_interest(position_id);

            let caller = get_caller_address();
            let current_debt = self.position_debt.read(position_id);
            let repay_amount = if amount > current_debt { current_debt } else { amount };
            let rate = self.position_interest_rate.read(position_id);

            // Burn moonUSD
            let moonusd = IMoonUSDDispatcher { contract_address: self.moonusd_token.read() };
            moonusd.burn(caller, repay_amount);

            // Update debt
            self.position_debt.write(position_id, current_debt - repay_amount);

            // Update globals
            self.total_debt.write(self.total_debt.read() - repay_amount);
            self.weighted_rate_sum.write(
                self.weighted_rate_sum.read() - repay_amount * rate
            );

            self.emit(DebtRepaid { position_id, amount: repay_amount });
        }

        fn set_rate(ref self: ContractState, position_id: u256, new_rate: u256) {
            self._assert_position_owner(position_id);
            assert(self.position_active.read(position_id), 'Position not active');

            assert(new_rate >= 50, 'Rate below minimum');
            assert(new_rate <= 50000, 'Rate above maximum');

            self._accrue_interest(position_id);

            let old_rate = self.position_interest_rate.read(position_id);
            let debt = self.position_debt.read(position_id);
            let timestamp = get_block_timestamp();

            // If decreasing rate, enforce 12hr cooldown
            if new_rate < old_rate {
                let cooldown_expiry = self.position_rate_cooldown.read(position_id);
                assert(timestamp >= cooldown_expiry, 'Rate cooldown active');
                self.position_rate_cooldown.write(position_id, timestamp + 43200); // 12 hours
            }

            // Update rate
            self.position_interest_rate.write(position_id, new_rate);

            // Update weighted_rate_sum
            self.weighted_rate_sum.write(
                self.weighted_rate_sum.read() - debt * old_rate + debt * new_rate
            );

            // Re-insert in redemption queue
            let redemption_mgr = IRedemptionManagerDispatcher { contract_address: self.redemption_manager.read() };
            redemption_mgr.re_insert(position_id, new_rate);

            self.emit(RateChanged { position_id, old_rate, new_rate });
        }

        fn liquidate(ref self: ContractState, position_id: u256) {
            assert(self.position_active.read(position_id), 'Position not active');

            self._accrue_interest(position_id);

            // Check HF <= 1.0
            let hf = self._calculate_hf(position_id);
            assert(hf <= SCALE, 'Position is healthy');

            let debt = self.position_debt.read(position_id);
            let collateral_amount = self.position_collateral_amount.read(position_id);
            let collateral_type = self.position_collateral_type.read(position_id);
            let rate = self.position_interest_rate.read(position_id);
            let penalty_bps = self.collateral_liq_penalty.read(collateral_type);

            // Calculate collateral distribution
            let penalty_amount = collateral_amount * penalty_bps / BPS_SCALE;
            let collateral_for_sp = collateral_amount - penalty_amount;

            // Try Stability Pool absorption
            let sp = IStabilityPoolDispatcher { contract_address: self.stability_pool.read() };
            let sp_balance = sp.get_total_deposits();

            assert(sp_balance >= debt, 'SP insufficient for liquidation');

            // Transfer collateral to Stability Pool
            let collateral_token_addr = self.collateral_token.read(collateral_type);
            let collateral_token = IERC20Dispatcher { contract_address: collateral_token_addr };
            let sp_address = self.stability_pool.read();
            collateral_token.transfer(sp_address, collateral_for_sp);

            // Send penalty to treasury
            let treasury = self.treasury.read();
            if penalty_amount > 0 {
                collateral_token.transfer(treasury, penalty_amount);
            }

            // SP absorbs liquidation (burns moonUSD, credits collateral gains)
            sp.absorb_liquidation(debt, collateral_type, collateral_for_sp);

            // Burn NFT
            let nft = IPositionNFTDispatcher { contract_address: self.position_nft.read() };
            nft.burn(position_id);

            // Clear position
            self.position_active.write(position_id, false);
            self.position_debt.write(position_id, 0);
            self.position_collateral_amount.write(position_id, 0);

            // Update globals
            self.total_debt.write(self.total_debt.read() - debt);
            self.weighted_rate_sum.write(self.weighted_rate_sum.read() - debt * rate);
            self.active_position_count.write(self.active_position_count.read() - 1);

            // Remove from redemption queue
            let redemption_mgr = IRedemptionManagerDispatcher { contract_address: self.redemption_manager.read() };
            redemption_mgr.remove(position_id);

            self.emit(PositionLiquidated {
                position_id, debt_absorbed: debt, collateral_distributed: collateral_for_sp,
            });
        }

        fn get_position(self: @ContractState, position_id: u256) -> PositionData {
            PositionData {
                collateral_type: self.position_collateral_type.read(position_id),
                collateral_amount: self.position_collateral_amount.read(position_id),
                debt: self.position_debt.read(position_id),
                interest_rate: self.position_interest_rate.read(position_id),
                last_update: self.position_last_update.read(position_id),
                created_at: self.position_created_at.read(position_id),
            }
        }

        fn get_health_factor(self: @ContractState, position_id: u256) -> u256 {
            self._calculate_hf_view(position_id)
        }

        fn get_current_debt(self: @ContractState, position_id: u256) -> u256 {
            let debt = self.position_debt.read(position_id);
            let rate = self.position_interest_rate.read(position_id);
            let last_update = self.position_last_update.read(position_id);
            let now = get_block_timestamp();
            let dt = now - last_update;
            interest::accrue_interest(debt, rate, dt)
        }

        fn get_market_average_rate(self: @ContractState) -> u256 {
            self._get_market_average_rate()
        }

        fn get_borrow_fee(self: @ContractState, mint_amount: u256) -> u256 {
            let market_rate = self._get_market_average_rate();
            interest::calculate_borrow_fee(mint_amount, market_rate, 7)
        }

        fn get_total_debt(self: @ContractState) -> u256 {
            self.total_debt.read()
        }

        fn get_active_positions(self: @ContractState) -> u256 {
            self.active_position_count.read()
        }

        fn add_collateral_type(
            ref self: ContractState,
            key: felt252,
            token: ContractAddress,
            ltv_max: u256,
            liq_penalty: u256,
        ) {
            self.ownable.assert_only_owner();
            self.collateral_token.write(key, token);
            self.collateral_ltv_max.write(key, ltv_max);
            self.collateral_liq_penalty.write(key, liq_penalty);
            self.collateral_decimals.write(key, 8); // Default BTC decimals
            self.collateral_enabled.write(key, true);
        }

        fn set_collateral_enabled(ref self: ContractState, key: felt252, enabled: bool) {
            self.ownable.assert_only_owner();
            self.collateral_enabled.write(key, enabled);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_position_owner(self: @ContractState, position_id: u256) {
            let caller = get_caller_address();
            let nft = IPositionNFTDispatcher { contract_address: self.position_nft.read() };
            let owner = nft.owner_of_position(position_id);
            assert(caller == owner, 'Not position owner');
        }

        fn _accrue_interest(ref self: ContractState, position_id: u256) {
            let debt = self.position_debt.read(position_id);
            let rate = self.position_interest_rate.read(position_id);
            let last_update = self.position_last_update.read(position_id);
            let now = get_block_timestamp();

            if now > last_update {
                let dt = now - last_update;
                let new_debt = interest::accrue_interest(debt, rate, dt);
                let interest_amount = new_debt - debt;

                self.position_debt.write(position_id, new_debt);
                self.position_last_update.write(position_id, now);

                if interest_amount > 0 {
                    self.total_debt.write(self.total_debt.read() + interest_amount);
                    self.weighted_rate_sum.write(
                        self.weighted_rate_sum.read() + interest_amount * rate
                    );
                }
            }
        }

        fn _calculate_hf(self: @ContractState, position_id: u256) -> u256 {
            let collateral_amount = self.position_collateral_amount.read(position_id);
            let debt = self.position_debt.read(position_id);
            let collateral_type = self.position_collateral_type.read(position_id);

            if debt == 0 {
                return 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF_u256;
            }

            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (price, _) = oracle.get_price_twap(collateral_type);
            let decimals = self.collateral_decimals.read(collateral_type);
            let collateral_value = interest::calculate_collateral_value(collateral_amount, price, decimals);
            let ltv_max = self.collateral_ltv_max.read(collateral_type);

            interest::calculate_health_factor(collateral_value, ltv_max, debt)
        }

        fn _calculate_hf_view(self: @ContractState, position_id: u256) -> u256 {
            // Same as _calculate_hf but for view functions
            self._calculate_hf(position_id)
        }

        fn _get_market_average_rate(self: @ContractState) -> u256 {
            interest::calculate_market_average_rate(
                self.weighted_rate_sum.read(),
                self.total_debt.read()
            )
        }
    }
}
