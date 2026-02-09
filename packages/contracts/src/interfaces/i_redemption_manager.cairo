#[starknet::interface]
pub trait IRedemptionManager<TContractState> {
    fn redeem(ref self: TContractState, moonusd_amount: u256) -> u256;
    fn insert(ref self: TContractState, position_id: u256, interest_rate: u256);
    fn remove(ref self: TContractState, position_id: u256);
    fn re_insert(ref self: TContractState, position_id: u256, new_rate: u256);
    fn get_redemption_fee(self: @TContractState) -> u256;
    fn get_base_rate(self: @TContractState) -> u256;
    fn get_sorted_head(self: @TContractState) -> u256;
    fn get_queue_size(self: @TContractState) -> u256;
}
