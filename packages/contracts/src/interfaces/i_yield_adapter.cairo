#[starknet::interface]
pub trait IYieldAdapter<TContractState> {
    fn deploy(ref self: TContractState, amount: u256);
    fn withdraw(ref self: TContractState, amount: u256) -> u256;
    fn harvest(ref self: TContractState) -> u256;
    fn get_deployed_capital(self: @TContractState) -> u256;
    fn get_current_apy_bps(self: @TContractState) -> u256;
    fn is_active(self: @TContractState) -> bool;
}
