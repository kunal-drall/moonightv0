use starknet::ContractAddress;

#[starknet::interface]
pub trait IExtendedDex<TContractState> {
    fn deposit_margin(ref self: TContractState, amount: u256);
    fn withdraw_margin(ref self: TContractState, amount: u256);
    fn open_position(ref self: TContractState, market_id: felt252, size: u256, is_long: bool);
    fn close_position(ref self: TContractState, market_id: felt252);
    fn get_position_pnl(self: @TContractState, account: ContractAddress, market_id: felt252) -> u256;
    fn get_funding_rate(self: @TContractState, market_id: felt252) -> u256;
    fn get_margin_balance(self: @TContractState, account: ContractAddress) -> u256;
}
