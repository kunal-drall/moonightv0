use starknet::ContractAddress;

#[starknet::interface]
pub trait IPositionNFT<TContractState> {
    fn mint(ref self: TContractState, to: ContractAddress) -> u256;
    fn burn(ref self: TContractState, token_id: u256);
    fn set_cdp_manager(ref self: TContractState, cdp_manager: ContractAddress);
    fn get_total_supply(self: @TContractState) -> u256;
    fn owner_of_position(self: @TContractState, token_id: u256) -> ContractAddress;
}
