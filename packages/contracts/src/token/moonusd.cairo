// moonUSD - Protocol stablecoin token
// ERC-20 with restricted mint/burn authority
// Only authorized minters (CDPManager) can mint
// Only authorized burners (CDPManager, StabilityPool, RedemptionManager) can burn

#[starknet::contract]
pub mod MoonUSD {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_access::ownable::OwnableComponent;

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
        // Pause state
        paused: bool,
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

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract is paused');
        }
    }
}
