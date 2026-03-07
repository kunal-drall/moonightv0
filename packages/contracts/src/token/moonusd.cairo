// moonUSD - Protocol stablecoin token
// ERC-20 with restricted mint/burn authority
// Only authorized minters (CDPManager) can mint
// Only authorized burners (CDPManager, StabilityPool, RedemptionManager) can burn

#[starknet::contract]
pub mod MoonUSD {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use moonight::interfaces::i_flash_borrower::{IFlashBorrowerDispatcher, IFlashBorrowerDispatcherTrait};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // ERC20 external
    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    // Ownable external
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Authorization maps
        minters: Map<ContractAddress, bool>,
        burners: Map<ContractAddress, bool>,
        // Tracking
        total_minted_ever: u256,
        // Flash mint
        flash_mint_fee_bps: u256,
        flash_mint_enabled: bool,
        treasury: ContractAddress,
        // Pause state
        paused: bool,
        // Reentrancy guard
        flash_lock: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        MinterAdded: MinterAdded,
        MinterRemoved: MinterRemoved,
        BurnerAdded: BurnerAdded,
        BurnerRemoved: BurnerRemoved,
        Paused: Paused,
        Unpaused: Unpaused,
        FlashMint: FlashMint,
    }

    #[derive(Drop, starknet::Event)]
    struct FlashMint {
        #[key]
        borrower: ContractAddress,
        amount: u256,
        fee: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct MinterAdded {
        #[key]
        minter: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct MinterRemoved {
        #[key]
        minter: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct BurnerAdded {
        #[key]
        burner: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct BurnerRemoved {
        #[key]
        burner: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct Paused {}

    #[derive(Drop, starknet::Event)]
    struct Unpaused {}

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.erc20.initializer("moonUSD", "mUSD");
        self.ownable.initializer(owner);
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl MoonUSDImpl of moonight::interfaces::i_moonusd::IMoonUSD<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self._assert_not_paused();
            let caller = get_caller_address();
            assert(self.minters.read(caller), 'Caller is not a minter');
            self.erc20.mint(to, amount);
            self.total_minted_ever.write(self.total_minted_ever.read() + amount);
        }

        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            let caller = get_caller_address();
            assert(self.burners.read(caller), 'Caller is not a burner');
            self.erc20.burn(from, amount);
        }

        fn add_minter(ref self: ContractState, minter: ContractAddress) {
            self.ownable.assert_only_owner();
            self.minters.write(minter, true);
            self.emit(MinterAdded { minter });
        }

        fn remove_minter(ref self: ContractState, minter: ContractAddress) {
            self.ownable.assert_only_owner();
            self.minters.write(minter, false);
            self.emit(MinterRemoved { minter });
        }

        fn add_burner(ref self: ContractState, burner: ContractAddress) {
            self.ownable.assert_only_owner();
            self.burners.write(burner, true);
            self.emit(BurnerAdded { burner });
        }

        fn remove_burner(ref self: ContractState, burner: ContractAddress) {
            self.ownable.assert_only_owner();
            self.burners.write(burner, false);
            self.emit(BurnerRemoved { burner });
        }

        fn is_minter(self: @ContractState, address: ContractAddress) -> bool {
            self.minters.read(address)
        }

        fn is_burner(self: @ContractState, address: ContractAddress) -> bool {
            self.burners.read(address)
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.paused.write(true);
            self.emit(Paused {});
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.paused.write(false);
            self.emit(Unpaused {});
        }
    }

    // Flash mint
    #[external(v0)]
    fn flash_mint(
        ref self: ContractState,
        borrower: ContractAddress,
        amount: u256,
        data: Span<felt252>,
    ) {
        self._assert_not_paused();
        assert(!self.flash_lock.read(), 'Flash mint reentrant');
        assert(self.flash_mint_enabled.read(), 'Flash mint disabled');
        assert(amount > 0, 'Zero amount');

        self.flash_lock.write(true);

        let caller = get_caller_address();
        let fee_bps = self.flash_mint_fee_bps.read();
        let fee = amount * fee_bps / 10000;

        // 1. Mint to borrower
        self.erc20.mint(borrower, amount);

        // 2. Callback — borrower must return magic value
        let flash_borrower = IFlashBorrowerDispatcher { contract_address: borrower };
        let result = flash_borrower.on_flash_loan(caller, amount, fee, data);
        assert(result == 'FLASH_LOAN_CALLBACK', 'Invalid callback return');

        // 3. Burn principal from borrower
        let borrower_balance = self.erc20.ERC20_balances.read(borrower);
        assert(borrower_balance >= amount + fee, 'Insufficient repayment');
        self.erc20.burn(borrower, amount);

        // 4. Transfer fee to treasury
        if fee > 0 {
            let treasury = self.treasury.read();
            let zero: ContractAddress = starknet::contract_address_const::<0>();
            assert(treasury != zero, 'Treasury not set');
            // Use internal transfer: reduce borrower balance, increase treasury balance
            self.erc20._transfer(borrower, treasury, fee);
        }

        self.emit(FlashMint { borrower, amount, fee });
        self.flash_lock.write(false);
    }

    #[external(v0)]
    fn set_flash_mint_fee(ref self: ContractState, fee_bps: u256) {
        self.ownable.assert_only_owner();
        assert(fee_bps <= 100, 'Fee too high'); // Max 1%
        self.flash_mint_fee_bps.write(fee_bps);
    }

    #[external(v0)]
    fn set_flash_mint_enabled(ref self: ContractState, enabled: bool) {
        self.ownable.assert_only_owner();
        self.flash_mint_enabled.write(enabled);
    }

    #[external(v0)]
    fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
        self.ownable.assert_only_owner();
        self.treasury.write(treasury);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract is paused');
        }
    }
}
