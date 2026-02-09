use starknet::ContractAddress;

#[starknet::interface]
pub trait IMoonUSD<TContractState> {
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
    fn burn(ref self: TContractState, from: ContractAddress, amount: u256);
    fn add_minter(ref self: TContractState, minter: ContractAddress);
    fn remove_minter(ref self: TContractState, minter: ContractAddress);
    fn add_burner(ref self: TContractState, burner: ContractAddress);
    fn remove_burner(ref self: TContractState, burner: ContractAddress);
    fn is_minter(self: @TContractState, address: ContractAddress) -> bool;
    fn is_burner(self: @TContractState, address: ContractAddress) -> bool;
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}
