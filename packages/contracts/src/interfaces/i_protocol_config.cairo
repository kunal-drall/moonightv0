use starknet::ContractAddress;

#[starknet::interface]
pub trait IProtocolConfig<TContractState> {
    fn get_min_debt(self: @TContractState) -> u256;
    fn get_borrow_fee_days(self: @TContractState) -> u256;
    fn get_rate_cooldown_seconds(self: @TContractState) -> u64;
    fn get_min_rate_bps(self: @TContractState) -> u256;
    fn get_max_rate_bps(self: @TContractState) -> u256;
    fn get_sp_interest_share_bps(self: @TContractState) -> u256;
    fn get_treasury_interest_share_bps(self: @TContractState) -> u256;
    fn get_min_hf_after_withdrawal(self: @TContractState) -> u256;
    fn get_treasury(self: @TContractState) -> ContractAddress;
    fn get_guardian(self: @TContractState) -> ContractAddress;
    fn is_emergency_mode(self: @TContractState) -> bool;
    fn set_min_debt(ref self: TContractState, value: u256);
    fn set_treasury(ref self: TContractState, address: ContractAddress);
    fn set_guardian(ref self: TContractState, address: ContractAddress);
    fn set_emergency_mode(ref self: TContractState, mode: bool);
}
