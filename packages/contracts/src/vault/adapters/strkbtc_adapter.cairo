// strkBTC Staking Yield Adapter (Stub) for Vault C
// Placeholder until strkBTC staking is live on Starknet

#[starknet::contract]
pub mod StrkBTCAdapter {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        vault: ContractAddress,
        deployed_capital: u256,
        last_apy_bps: u256,
        active: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, vault: ContractAddress) {
        self.ownable.initializer(owner);
        self.vault.write(vault);
        self.active.write(false); // Inactive until strkBTC staking is live
        self.last_apy_bps.write(0);
    }

    #[abi(embed_v0)]
    impl YieldAdapterImpl of moonight::interfaces::i_yield_adapter::IYieldAdapter<ContractState> {
        fn deploy(ref self: ContractState, amount: u256) {
            assert(get_caller_address() == self.vault.read(), 'Only vault');
            assert(self.active.read(), 'Adapter inactive');
            self.deployed_capital.write(self.deployed_capital.read() + amount);
        }

        fn withdraw(ref self: ContractState, amount: u256) -> u256 {
            assert(get_caller_address() == self.vault.read(), 'Only vault');
            let capital = self.deployed_capital.read();
            let w = if amount <= capital { amount } else { capital };
            self.deployed_capital.write(capital - w);
            w
        }

        fn harvest(ref self: ContractState) -> u256 {
            assert(get_caller_address() == self.vault.read(), 'Only vault');
            0
        }

        fn get_deployed_capital(self: @ContractState) -> u256 {
            self.deployed_capital.read()
        }

        fn get_current_apy_bps(self: @ContractState) -> u256 {
            self.last_apy_bps.read()
        }

        fn is_active(self: @ContractState) -> bool {
            self.active.read()
        }
    }

    #[external(v0)]
    fn set_apy_bps(ref self: ContractState, apy_bps: u256) {
        self.ownable.assert_only_owner();
        self.last_apy_bps.write(apy_bps);
    }

    #[external(v0)]
    fn set_active(ref self: ContractState, active: bool) {
        self.ownable.assert_only_owner();
        self.active.write(active);
    }
}
