#[starknet::contract]
pub mod VaultBStub {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        active: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.active.write(false);
    }

    #[external(v0)]
    fn is_active(self: @ContractState) -> bool {
        self.active.read()
    }

    #[external(v0)]
    fn get_vault_info(self: @ContractState) -> felt252 {
        'Vault B: Coming Soon'
    }
}
