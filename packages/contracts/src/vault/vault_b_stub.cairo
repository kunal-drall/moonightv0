// Vault B - Leveraged BTC Accumulation Vault
//
// Strategy: Deposit BTC → mint moonUSD at target LTV → swap moonUSD to BTC on Ekubo →
// deposit new BTC as collateral → repeat (up to 3x effective leverage).
//
// Auto-protection: vault auto-deleverages when health factor approaches danger zone.
// Users set a "target leverage" (1.5x, 2x, 3x) and vault maintains it through rebalancing.
// Exit: vault unwinds loop in reverse — sell BTC for moonUSD, repay debt, return net BTC.

#[starknet::contract]
pub mod VaultB {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use moonight::interfaces::i_cdp_manager::{ICDPManagerDispatcher, ICDPManagerDispatcherTrait};
    use moonight::interfaces::i_price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};
    use moonight::math::fixed_point::SCALE;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const BPS: u256 = 10_000;
    const MAX_LOOPS: u8 = 5; // Max 5 borrow-redeposit loops (≈3x leverage at 66% LTV)

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Protocol references
        btc_token: ContractAddress,
        moonusd_token: ContractAddress,
        cdp_manager: ContractAddress,
        price_oracle: ContractAddress,
        ekubo_router: ContractAddress,
        // User positions
        user_btc_deposited: Map<ContractAddress, u256>,   // Original BTC deposited by user
        user_total_btc: Map<ContractAddress, u256>,        // Total BTC in CDP (looped)
        user_total_debt: Map<ContractAddress, u256>,        // Total moonUSD debt
        user_target_leverage: Map<ContractAddress, u256>,   // Target leverage in BPS (15000 = 1.5x)
        user_position_id: Map<ContractAddress, u256>,       // CDP position NFT ID
        user_active: Map<ContractAddress, bool>,
        // Vault state
        total_btc_deposited: u256,
        total_users: u256,
        max_leverage_bps: u256,    // Max allowed leverage (30000 = 3.0x)
        vault_ltv_target: u256,    // LTV used for each loop (6600 = 66%)
        safety_buffer_bps: u256,   // Deleverage when within this % of liq threshold (1500 = 15%)
        keeper: ContractAddress,
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposit: Deposit,
        Withdraw: Withdraw,
        Leveraged: Leveraged,
        Deleveraged: Deleveraged,
        EmergencyDeleverage: EmergencyDeleverage,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        user: ContractAddress,
        btc_amount: u256,
        target_leverage: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdraw {
        #[key]
        user: ContractAddress,
        btc_returned: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Leveraged {
        #[key]
        user: ContractAddress,
        loops: u8,
        total_btc: u256,
        total_debt: u256,
        effective_leverage: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Deleveraged {
        #[key]
        user: ContractAddress,
        btc_sold: u256,
        debt_repaid: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyDeleverage {
        #[key]
        user: ContractAddress,
        reason: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        btc_token: ContractAddress,
        moonusd_token: ContractAddress,
        cdp_manager: ContractAddress,
        price_oracle: ContractAddress,
        ekubo_router: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.btc_token.write(btc_token);
        self.moonusd_token.write(moonusd_token);
        self.cdp_manager.write(cdp_manager);
        self.price_oracle.write(price_oracle);
        self.ekubo_router.write(ekubo_router);
        self.max_leverage_bps.write(30000);    // 3.0x max
        self.vault_ltv_target.write(6600);      // 66% LTV per loop
        self.safety_buffer_bps.write(1500);     // 15% safety buffer
    }

    // =================== External (User) ===================

    #[external(v0)]
    fn deposit(ref self: ContractState, btc_amount: u256, target_leverage_bps: u256) {
        assert(!self.paused.read(), 'Vault is paused');
        let caller = get_caller_address();
        assert(!self.user_active.read(caller), 'Position already active');
        assert(btc_amount > 0, 'Zero deposit');
        assert(target_leverage_bps >= 10000, 'Min leverage 1.0x');
        assert(target_leverage_bps <= self.max_leverage_bps.read(), 'Exceeds max leverage');

        // Transfer BTC from user
        let btc = IERC20Dispatcher { contract_address: self.btc_token.read() };
        btc.transfer_from(caller, get_contract_address(), btc_amount);

        // Store user position
        self.user_btc_deposited.write(caller, btc_amount);
        self.user_target_leverage.write(caller, target_leverage_bps);
        self.user_active.write(caller, true);
        self.total_btc_deposited.write(self.total_btc_deposited.read() + btc_amount);
        self.total_users.write(self.total_users.read() + 1);

        // Execute leverage loop
        self._execute_leverage(caller, btc_amount, target_leverage_bps);

        self.emit(Deposit { user: caller, btc_amount, target_leverage: target_leverage_bps });
    }

    #[external(v0)]
    fn withdraw(ref self: ContractState) {
        let caller = get_caller_address();
        assert(self.user_active.read(caller), 'No active position');

        // Unwind the leveraged position
        let net_btc = self._unwind_position(caller);

        // Transfer net BTC back to user
        let btc = IERC20Dispatcher { contract_address: self.btc_token.read() };
        btc.transfer(caller, net_btc);

        // Clear state
        let deposited = self.user_btc_deposited.read(caller);
        self.total_btc_deposited.write(self.total_btc_deposited.read() - deposited);
        self.total_users.write(self.total_users.read() - 1);
        self.user_btc_deposited.write(caller, 0);
        self.user_total_btc.write(caller, 0);
        self.user_total_debt.write(caller, 0);
        self.user_target_leverage.write(caller, 0);
        self.user_position_id.write(caller, 0);
        self.user_active.write(caller, false);

        self.emit(Withdraw { user: caller, btc_returned: net_btc });
    }

    #[external(v0)]
    fn adjust_leverage(ref self: ContractState, new_target_leverage_bps: u256) {
        assert(!self.paused.read(), 'Vault is paused');
        let caller = get_caller_address();
        assert(self.user_active.read(caller), 'No active position');
        assert(new_target_leverage_bps >= 10000, 'Min leverage 1.0x');
        assert(new_target_leverage_bps <= self.max_leverage_bps.read(), 'Exceeds max leverage');

        let current = self.user_target_leverage.read(caller);
        if new_target_leverage_bps > current {
            // Increasing leverage: add more loops
            let total_btc = self.user_total_btc.read(caller);
            self.user_target_leverage.write(caller, new_target_leverage_bps);
            self._execute_leverage(caller, total_btc, new_target_leverage_bps);
        } else if new_target_leverage_bps < current {
            // Decreasing leverage: partial unwind
            self.user_target_leverage.write(caller, new_target_leverage_bps);
            self._partial_deleverage(caller, new_target_leverage_bps);
        }
    }

    // =================== External (Keeper / Protection) ===================

    /// Keeper monitors health factors and auto-deleverages positions approaching liquidation
    #[external(v0)]
    fn check_and_deleverage(ref self: ContractState, user: ContractAddress) {
        let caller = get_caller_address();
        assert(caller == self.keeper.read() || caller == self.ownable.owner(), 'Not keeper');
        assert(self.user_active.read(user), 'No active position');

        let total_btc = self.user_total_btc.read(user);
        let total_debt = self.user_total_debt.read(user);

        if total_debt == 0 || total_btc == 0 {
            return;
        }

        // Get BTC price and calculate current LTV
        let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
        let (btc_price, _) = oracle.get_price('WBTC');
        let collateral_value = (total_btc * btc_price) / SCALE;
        let current_ltv_bps = (total_debt * BPS) / collateral_value;

        // If LTV exceeds (target - safety_buffer), deleverage one step
        let safety = self.safety_buffer_bps.read();
        let danger_ltv = self.vault_ltv_target.read() + safety;

        if current_ltv_bps >= danger_ltv {
            self._partial_deleverage(user, self.user_target_leverage.read(user) - 5000);
            self.emit(EmergencyDeleverage { user, reason: 'Health factor danger' });
        }
    }

    // =================== View Functions ===================

    #[external(v0)]
    fn get_user_position(self: @ContractState, user: ContractAddress) -> (u256, u256, u256, u256, bool) {
        (
            self.user_btc_deposited.read(user),
            self.user_total_btc.read(user),
            self.user_total_debt.read(user),
            self.user_target_leverage.read(user),
            self.user_active.read(user),
        )
    }

    #[external(v0)]
    fn get_effective_leverage(self: @ContractState, user: ContractAddress) -> u256 {
        let deposited = self.user_btc_deposited.read(user);
        let total = self.user_total_btc.read(user);
        if deposited == 0 { return 0; }
        (total * BPS) / deposited
    }

    #[external(v0)]
    fn get_vault_stats(self: @ContractState) -> (u256, u256, u256) {
        (self.total_btc_deposited.read(), self.total_users.read(), self.max_leverage_bps.read())
    }

    #[external(v0)]
    fn is_active(self: @ContractState) -> bool {
        !self.paused.read()
    }

    // =================== Admin ===================

    #[external(v0)]
    fn set_keeper(ref self: ContractState, keeper: ContractAddress) {
        self.ownable.assert_only_owner();
        self.keeper.write(keeper);
    }

    #[external(v0)]
    fn set_max_leverage(ref self: ContractState, max_leverage_bps: u256) {
        self.ownable.assert_only_owner();
        assert(max_leverage_bps >= 10000 && max_leverage_bps <= 50000, 'Invalid leverage');
        self.max_leverage_bps.write(max_leverage_bps);
    }

    #[external(v0)]
    fn set_paused(ref self: ContractState, paused: bool) {
        self.ownable.assert_only_owner();
        self.paused.write(paused);
    }

    // =================== Internal ===================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Execute the leverage loop: deposit BTC → mint moonUSD → swap to BTC → repeat
        fn _execute_leverage(
            ref self: ContractState,
            user: ContractAddress,
            initial_btc: u256,
            target_leverage_bps: u256,
        ) {
            let _cdp = ICDPManagerDispatcher { contract_address: self.cdp_manager.read() };
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (btc_price, _) = oracle.get_price('WBTC');
            let ltv_target = self.vault_ltv_target.read();

            let mut accumulated_btc = initial_btc;
            let mut accumulated_debt: u256 = 0;
            let mut loop_count: u8 = 0;

            // Calculate target total BTC from leverage
            // target_total = initial * leverage / 10000
            let target_total = (initial_btc * target_leverage_bps) / BPS;

            loop {
                if loop_count >= MAX_LOOPS {
                    break;
                }
                if accumulated_btc >= target_total {
                    break;
                }

                // Calculate how much moonUSD to mint from current BTC
                let collateral_value = (accumulated_btc * btc_price) / SCALE;
                let max_mint = (collateral_value * ltv_target) / BPS;

                // Only mint what we haven't already minted
                let new_mint = if max_mint > accumulated_debt {
                    max_mint - accumulated_debt
                } else {
                    break;
                };

                if new_mint < 200 * SCALE {
                    break; // Below min debt threshold
                }

                // In production: call cdp.mint_more(position_id, new_mint)
                // Then swap moonUSD → BTC via Ekubo router
                // For now, track the accounting:
                let new_btc = (new_mint * SCALE) / btc_price;
                accumulated_btc = accumulated_btc + new_btc;
                accumulated_debt = accumulated_debt + new_mint;
                loop_count += 1;
            };

            // Store final state
            self.user_total_btc.write(user, accumulated_btc);
            self.user_total_debt.write(user, accumulated_debt);

            let effective_leverage = if initial_btc > 0 {
                (accumulated_btc * BPS) / initial_btc
            } else {
                0
            };

            self.emit(Leveraged {
                user,
                loops: loop_count,
                total_btc: accumulated_btc,
                total_debt: accumulated_debt,
                effective_leverage,
            });
        }

        /// Unwind the entire leveraged position: sell BTC → repay debt → return net
        fn _unwind_position(ref self: ContractState, user: ContractAddress) -> u256 {
            let total_btc = self.user_total_btc.read(user);
            let total_debt = self.user_total_debt.read(user);

            if total_debt == 0 {
                return total_btc;
            }

            // In production: swap enough BTC → moonUSD to repay debt, then close CDP
            // The net BTC = total_btc - (debt_value_in_btc)
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (btc_price, _) = oracle.get_price('WBTC');

            let debt_in_btc = (total_debt * SCALE) / btc_price;
            let net_btc = if total_btc > debt_in_btc {
                total_btc - debt_in_btc
            } else {
                0
            };

            self.emit(Deleveraged { user, btc_sold: debt_in_btc, debt_repaid: total_debt });

            net_btc
        }

        /// Partially deleverage to reduce to a new target
        fn _partial_deleverage(ref self: ContractState, user: ContractAddress, new_target_bps: u256) {
            let deposited = self.user_btc_deposited.read(user);
            let total_btc = self.user_total_btc.read(user);
            let total_debt = self.user_total_debt.read(user);

            let new_target_btc = (deposited * new_target_bps) / BPS;

            if new_target_btc >= total_btc {
                return; // Already below target
            }

            let btc_to_sell = total_btc - new_target_btc;
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (btc_price, _) = oracle.get_price('WBTC');
            let debt_to_repay = (btc_to_sell * btc_price) / SCALE;

            let new_debt = if total_debt > debt_to_repay {
                total_debt - debt_to_repay
            } else {
                0
            };

            self.user_total_btc.write(user, new_target_btc);
            self.user_total_debt.write(user, new_debt);

            self.emit(Deleveraged { user, btc_sold: btc_to_sell, debt_repaid: debt_to_repay });
        }
    }
}
