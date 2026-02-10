// Mock Extended DEX for Vault A testing
#[starknet::contract]
pub mod MockExtendedDex {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        margin_balances: Map<ContractAddress, u256>,
        funding_rate: u256,
        position_pnl: Map<(ContractAddress, felt252), u256>,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[external(v0)]
    fn set_funding_rate(ref self: ContractState, rate: u256) {
        self.funding_rate.write(rate);
    }

    #[external(v0)]
    fn set_position_pnl(ref self: ContractState, account: ContractAddress, market_id: felt252, pnl: u256) {
        self.position_pnl.write((account, market_id), pnl);
    }

    #[abi(embed_v0)]
    impl MockExtendedImpl of moonight::interfaces::i_extended_dex::IExtendedDex<ContractState> {
        fn deposit_margin(ref self: ContractState, amount: u256) {
            let caller = starknet::get_caller_address();
            let current = self.margin_balances.read(caller);
            self.margin_balances.write(caller, current + amount);
        }

        fn withdraw_margin(ref self: ContractState, amount: u256) {
            let caller = starknet::get_caller_address();
            let current = self.margin_balances.read(caller);
            assert(current >= amount, 'Insufficient margin');
            self.margin_balances.write(caller, current - amount);
        }

        fn open_position(ref self: ContractState, market_id: felt252, size: u256, is_long: bool) {}
        fn close_position(ref self: ContractState, market_id: felt252) {}

        fn get_position_pnl(self: @ContractState, account: ContractAddress, market_id: felt252) -> u256 {
            self.position_pnl.read((account, market_id))
        }

        fn get_funding_rate(self: @ContractState, market_id: felt252) -> u256 {
            self.funding_rate.read()
        }

        fn get_margin_balance(self: @ContractState, account: ContractAddress) -> u256 {
            self.margin_balances.read(account)
        }
    }
}
