use starknet::ContractAddress;

#[starknet::interface]
pub trait IStabilityPool<TContractState> {
    fn deposit(ref self: TContractState, amount: u256);
    fn withdraw(ref self: TContractState, amount: u256);
    fn claim_collateral_gains(ref self: TContractState);
    fn claim_interest_yield(ref self: TContractState);
    fn absorb_liquidation(
        ref self: TContractState,
        debt_amount: u256,
        collateral_type: felt252,
        collateral_amount: u256,
    );
    fn distribute_interest(ref self: TContractState, amount: u256);
    fn get_total_deposits(self: @TContractState) -> u256;
    fn get_depositor_balance(self: @TContractState, depositor: ContractAddress) -> u256;
    fn get_depositor_collateral_gain(
        self: @TContractState, depositor: ContractAddress, collateral_type: felt252,
    ) -> u256;
    fn get_compounded_deposit(self: @TContractState, depositor: ContractAddress) -> u256;
    fn get_pending_interest_yield(self: @TContractState, depositor: ContractAddress) -> u256;
}
