// Vault D - BTC Covered Call Vault (Structured Product)
//
// Strategy: Deposit BTC → sell out-of-the-money BTC call options → earn premium as yield.
// If BTC stays below strike: keep full BTC + full premium.
// If BTC exceeds strike: BTC called away at strike price (capped upside).
//
// Yield tokenization: Issues Principal Token (PT) and Yield Token (YT) — Pendle-style.
// PT = BTC principal redeemable at maturity. YT = stream of option premiums, tradeable.

#[starknet::contract]
pub mod VaultD {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use moonight::interfaces::i_price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};
    use moonight::math::fixed_point::SCALE;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const BPS: u256 = 10_000;
    const NOT_ENTERED: felt252 = 'NOT_ENTERED';
    const ENTERED: felt252 = 'ENTERED';

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Token references
        btc_token: ContractAddress,
        moonusd_token: ContractAddress,
        usdc_token: ContractAddress,
        price_oracle: ContractAddress,
        // Epoch management (weekly or bi-weekly option cycles)
        current_epoch: u256,
        epoch_start: u64,
        epoch_duration: u64,          // Duration in seconds (default: 7 days)
        epoch_strike_price: Map<u256, u256>,   // epoch → strike price (18 dec)
        epoch_premium_rate: Map<u256, u256>,   // epoch → premium in BPS of notional
        epoch_settled: Map<u256, bool>,
        epoch_btc_called: Map<u256, bool>,     // Whether BTC was called away
        // User positions
        user_btc_deposited: Map<ContractAddress, u256>,
        user_entry_epoch: Map<ContractAddress, u256>,
        user_pt_balance: Map<ContractAddress, u256>,    // Principal Token balance
        user_yt_balance: Map<ContractAddress, u256>,    // Yield Token balance
        user_claimed_through: Map<ContractAddress, u256>, // Last epoch yield claimed
        user_active: Map<ContractAddress, bool>,
        // Vault totals
        total_btc_deposited: u256,
        total_pt_supply: u256,
        total_yt_supply: u256,
        total_users: u256,
        total_premiums_earned: u256,
        // Config
        default_strike_offset_bps: u256,  // Strike = spot * (1 + offset/10000), e.g., 1000 = 10% OTM
        min_deposit: u256,
        keeper: ContractAddress,
        premium_payout_token: felt252,    // 'moonusd' or 'usdc'
        paused: bool,
        // Fee
        treasury: ContractAddress,
        premium_fee_bps: u256, // default 500 = 5%
        // Reentrancy guard
        reentrancy_status: felt252,
        // Per-epoch snapshot of total BTC and YT supply for accurate premium calculation
        epoch_total_btc: Map<u256, u256>,
        epoch_total_yt: Map<u256, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Deposit: Deposit,
        Withdraw: Withdraw,
        EpochStarted: EpochStarted,
        EpochSettled: EpochSettled,
        PremiumClaimed: PremiumClaimed,
        YTTransferred: YTTransferred,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        user: ContractAddress,
        btc_amount: u256,
        pt_minted: u256,
        yt_minted: u256,
        epoch: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdraw {
        #[key]
        user: ContractAddress,
        btc_returned: u256,
        pt_burned: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct EpochStarted {
        epoch: u256,
        strike_price: u256,
        premium_rate_bps: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct EpochSettled {
        epoch: u256,
        btc_called: bool,
        settlement_price: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PremiumClaimed {
        #[key]
        user: ContractAddress,
        amount: u256,
        epochs_count: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct YTTransferred {
        #[key]
        from: ContractAddress,
        to: ContractAddress,
        amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        btc_token: ContractAddress,
        moonusd_token: ContractAddress,
        usdc_token: ContractAddress,
        price_oracle: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.btc_token.write(btc_token);
        self.moonusd_token.write(moonusd_token);
        self.usdc_token.write(usdc_token);
        self.price_oracle.write(price_oracle);
        self.epoch_duration.write(604800);           // 7 days
        self.default_strike_offset_bps.write(1000);  // 10% OTM
        self.min_deposit.write(SCALE / 1000);        // 0.001 BTC min
        self.premium_payout_token.write('usdc');
        self.current_epoch.write(0);
        self.premium_fee_bps.write(500);             // 5% premium fee
        self.reentrancy_status.write(NOT_ENTERED);
    }

    // =================== External (User) ===================

    /// Deposit BTC and receive PT (principal) + YT (yield) tokens
    #[external(v0)]
    fn deposit(ref self: ContractState, btc_amount: u256) {
        assert(self.reentrancy_status.read() != ENTERED, 'Reentrant call');
        self.reentrancy_status.write(ENTERED);
        assert(!self.paused.read(), 'Vault is paused');
        let caller = get_caller_address();
        assert(btc_amount >= self.min_deposit.read(), 'Below min deposit');

        // Transfer BTC from user
        let btc = IERC20Dispatcher { contract_address: self.btc_token.read() };
        btc.transfer_from(caller, get_contract_address(), btc_amount);

        // Mint PT and YT 1:1 with BTC deposited
        let pt_amount = btc_amount;
        let yt_amount = btc_amount;

        let existing_pt = self.user_pt_balance.read(caller);
        let existing_yt = self.user_yt_balance.read(caller);
        self.user_pt_balance.write(caller, existing_pt + pt_amount);
        self.user_yt_balance.write(caller, existing_yt + yt_amount);
        self.user_btc_deposited.write(caller, self.user_btc_deposited.read(caller) + btc_amount);

        let epoch = self.current_epoch.read();
        if !self.user_active.read(caller) {
            self.user_entry_epoch.write(caller, epoch);
            self.user_claimed_through.write(caller, epoch);
            self.user_active.write(caller, true);
            self.total_users.write(self.total_users.read() + 1);
        }

        self.total_btc_deposited.write(self.total_btc_deposited.read() + btc_amount);
        self.total_pt_supply.write(self.total_pt_supply.read() + pt_amount);
        self.total_yt_supply.write(self.total_yt_supply.read() + yt_amount);

        self.emit(Deposit { user: caller, btc_amount, pt_minted: pt_amount, yt_minted: yt_amount, epoch });
        self.reentrancy_status.write(NOT_ENTERED);
    }

    /// Withdraw BTC by burning PT tokens (only after current epoch settles)
    #[external(v0)]
    fn withdraw(ref self: ContractState, pt_amount: u256) {
        assert(self.reentrancy_status.read() != ENTERED, 'Reentrant call');
        self.reentrancy_status.write(ENTERED);
        let caller = get_caller_address();
        assert(self.user_active.read(caller), 'No active position');
        let user_pt = self.user_pt_balance.read(caller);
        assert(pt_amount <= user_pt, 'Insufficient PT');

        // Check current epoch is settled
        let epoch = self.current_epoch.read();
        let is_settled = self.epoch_settled.read(epoch);
        assert(is_settled || self.paused.read(), 'Epoch not settled');

        // Calculate BTC to return (1:1 unless called)
        let btc_called = self.epoch_btc_called.read(epoch);
        let btc_to_return = if btc_called {
            // BTC was called away — return strike price value in stablecoins instead
            // In production: convert strike × amount to USDC and transfer
            // For now: return the BTC amount adjusted by strike/spot ratio
            let strike = self.epoch_strike_price.read(epoch);
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let (spot, _) = oracle.get_price('WBTC');
            if spot > 0 {
                (pt_amount * strike) / spot
            } else {
                pt_amount
            }
        } else {
            pt_amount // Full BTC returned
        };

        // Transfer BTC
        let btc = IERC20Dispatcher { contract_address: self.btc_token.read() };
        btc.transfer(caller, btc_to_return);

        // Burn PT
        self.user_pt_balance.write(caller, user_pt - pt_amount);
        self.total_pt_supply.write(self.total_pt_supply.read() - pt_amount);
        self.total_btc_deposited.write(self.total_btc_deposited.read() - pt_amount);

        if self.user_pt_balance.read(caller) == 0 && self.user_yt_balance.read(caller) == 0 {
            self.user_active.write(caller, false);
            self.total_users.write(self.total_users.read() - 1);
        }

        self.emit(Withdraw { user: caller, btc_returned: btc_to_return, pt_burned: pt_amount });
        self.reentrancy_status.write(NOT_ENTERED);
    }

    /// Claim accumulated premium yield for all settled epochs since last claim
    #[external(v0)]
    fn claim_premium(ref self: ContractState) {
        assert(self.reentrancy_status.read() != ENTERED, 'Reentrant call');
        self.reentrancy_status.write(ENTERED);
        let caller = get_caller_address();
        let yt_balance = self.user_yt_balance.read(caller);
        assert(yt_balance > 0, 'No YT balance');

        let last_claimed = self.user_claimed_through.read(caller);
        let current = self.current_epoch.read();
        assert(current > last_claimed, 'Nothing to claim');

        let total_supply = self.total_yt_supply.read();
        assert(total_supply > 0, 'No YT supply');

        // Calculate total premium owed across all unclaimed settled epochs
        let mut total_premium: u256 = 0;
        let mut epoch = last_claimed + 1;
        let mut epochs_claimed: u256 = 0;

        loop {
            if epoch > current {
                break;
            }
            if !self.epoch_settled.read(epoch) {
                break;
            }

            let premium_rate = self.epoch_premium_rate.read(epoch);
            // Use epoch snapshots for accurate pro-rata (not current totals)
            let epoch_btc = self.epoch_total_btc.read(epoch);
            let epoch_yt = self.epoch_total_yt.read(epoch);
            if epoch_yt == 0 {
                epoch = epoch + 1;
                continue;
            }

            // User's share of premium: (yt_balance / epoch_yt_supply) * (epoch_btc * premium_rate / BPS)
            let epoch_total_premium = (epoch_btc * premium_rate) / BPS;
            let user_share = (epoch_total_premium * yt_balance) / epoch_yt;
            total_premium = total_premium + user_share;
            epochs_claimed = epochs_claimed + 1;
            epoch = epoch + 1;
        };

        assert(total_premium > 0, 'No premium to claim');
        self.user_claimed_through.write(caller, epoch - 1);

        // Pay premium in chosen token (USDC or moonUSD)
        let payout_token = if self.premium_payout_token.read() == 'usdc' {
            self.usdc_token.read()
        } else {
            self.moonusd_token.read()
        };
        let token = IERC20Dispatcher { contract_address: payout_token };
        token.transfer(caller, total_premium);

        self.emit(PremiumClaimed { user: caller, amount: total_premium, epochs_count: epochs_claimed });
        self.reentrancy_status.write(NOT_ENTERED);
    }

    /// Transfer YT tokens to another address (trade yield separately from principal)
    #[external(v0)]
    fn transfer_yt(ref self: ContractState, to: ContractAddress, amount: u256) {
        let caller = get_caller_address();
        let from_balance = self.user_yt_balance.read(caller);
        assert(amount <= from_balance, 'Insufficient YT');

        self.user_yt_balance.write(caller, from_balance - amount);
        let to_balance = self.user_yt_balance.read(to);
        self.user_yt_balance.write(to, to_balance + amount);

        // Initialize claim tracking for receiver if needed
        if self.user_claimed_through.read(to) == 0 {
            self.user_claimed_through.write(to, self.current_epoch.read());
        }

        self.emit(YTTransferred { from: caller, to, amount });
    }

    // =================== View Functions ===================

    #[external(v0)]
    fn get_user_position(self: @ContractState, user: ContractAddress) -> (u256, u256, u256, u256) {
        (
            self.user_btc_deposited.read(user),
            self.user_pt_balance.read(user),
            self.user_yt_balance.read(user),
            self.user_entry_epoch.read(user),
        )
    }

    #[external(v0)]
    fn get_current_epoch(self: @ContractState) -> (u256, u256, u256, u64) {
        let epoch = self.current_epoch.read();
        (
            epoch,
            self.epoch_strike_price.read(epoch),
            self.epoch_premium_rate.read(epoch),
            self.epoch_start.read(),
        )
    }

    #[external(v0)]
    fn get_vault_stats(self: @ContractState) -> (u256, u256, u256, u256, u256) {
        (
            self.total_btc_deposited.read(),
            self.total_pt_supply.read(),
            self.total_yt_supply.read(),
            self.total_users.read(),
            self.total_premiums_earned.read(),
        )
    }

    #[external(v0)]
    fn is_active(self: @ContractState) -> bool {
        !self.paused.read()
    }

    // =================== Keeper / Admin ===================

    /// Keeper starts a new option epoch by setting strike and premium
    #[external(v0)]
    fn start_epoch(ref self: ContractState, strike_price: u256, premium_rate_bps: u256) {
        let caller = get_caller_address();
        assert(caller == self.keeper.read() || caller == self.ownable.owner(), 'Not keeper');
        assert(premium_rate_bps > 0 && premium_rate_bps <= 500, 'Invalid premium rate');

        let prev_epoch = self.current_epoch.read();
        if prev_epoch > 0 {
            assert(self.epoch_settled.read(prev_epoch), 'Previous epoch not settled');
        }

        let new_epoch = prev_epoch + 1;
        self.current_epoch.write(new_epoch);
        self.epoch_start.write(get_block_timestamp());
        self.epoch_strike_price.write(new_epoch, strike_price);
        self.epoch_premium_rate.write(new_epoch, premium_rate_bps);

        // Snapshot current totals for accurate premium distribution
        self.epoch_total_btc.write(new_epoch, self.total_btc_deposited.read());
        self.epoch_total_yt.write(new_epoch, self.total_yt_supply.read());

        self.emit(EpochStarted { epoch: new_epoch, strike_price, premium_rate_bps });
    }

    /// Keeper settles the current epoch — determines if calls were exercised
    #[external(v0)]
    fn settle_epoch(ref self: ContractState) {
        let caller = get_caller_address();
        assert(caller == self.keeper.read() || caller == self.ownable.owner(), 'Not keeper');

        let epoch = self.current_epoch.read();
        assert(!self.epoch_settled.read(epoch), 'Already settled');

        let start = self.epoch_start.read();
        let duration = self.epoch_duration.read();
        assert(get_block_timestamp() >= start + duration, 'Epoch not expired');

        // Check if BTC price exceeded strike
        let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
        let (spot, _) = oracle.get_price('WBTC');
        let strike = self.epoch_strike_price.read(epoch);

        let called = spot >= strike;
        self.epoch_btc_called.write(epoch, called);
        self.epoch_settled.write(epoch, true);

        // Track total premiums and deduct fee
        let premium_rate = self.epoch_premium_rate.read(epoch);
        let total_btc = self.total_btc_deposited.read();
        let gross_premium = (total_btc * premium_rate) / BPS;

        // Deduct 5% premium fee to treasury
        let fee_bps = self.premium_fee_bps.read();
        let fee = gross_premium * fee_bps / BPS;
        let net_premium = gross_premium - fee;

        if fee > 0 {
            let treasury = self.treasury.read();
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            if treasury != zero {
                let payout_token = if self.premium_payout_token.read() == 'usdc' {
                    self.usdc_token.read()
                } else {
                    self.moonusd_token.read()
                };
                let token = IERC20Dispatcher { contract_address: payout_token };
                token.transfer(treasury, fee);
            }
        }

        self.total_premiums_earned.write(self.total_premiums_earned.read() + net_premium);

        self.emit(EpochSettled { epoch, btc_called: called, settlement_price: spot });
    }

    #[external(v0)]
    fn set_keeper(ref self: ContractState, keeper: ContractAddress) {
        self.ownable.assert_only_owner();
        self.keeper.write(keeper);
    }

    #[external(v0)]
    fn set_premium_payout_token(ref self: ContractState, token: felt252) {
        self.ownable.assert_only_owner();
        assert(token == 'usdc' || token == 'moonusd', 'Invalid token');
        self.premium_payout_token.write(token);
    }

    #[external(v0)]
    fn set_default_strike_offset(ref self: ContractState, offset_bps: u256) {
        self.ownable.assert_only_owner();
        assert(offset_bps >= 200 && offset_bps <= 5000, 'Invalid offset');
        self.default_strike_offset_bps.write(offset_bps);
    }

    #[external(v0)]
    fn set_epoch_duration(ref self: ContractState, duration: u64) {
        self.ownable.assert_only_owner();
        assert(duration >= 86400 && duration <= 2592000, 'Invalid duration');
        self.epoch_duration.write(duration);
    }

    #[external(v0)]
    fn set_paused(ref self: ContractState, paused: bool) {
        self.ownable.assert_only_owner();
        self.paused.write(paused);
    }

    #[external(v0)]
    fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
        self.ownable.assert_only_owner();
        self.treasury.write(treasury);
    }

    #[external(v0)]
    fn set_premium_fee(ref self: ContractState, fee_bps: u256) {
        self.ownable.assert_only_owner();
        assert(fee_bps <= 1000, 'Fee too high'); // Max 10%
        self.premium_fee_bps.write(fee_bps);
    }
}
