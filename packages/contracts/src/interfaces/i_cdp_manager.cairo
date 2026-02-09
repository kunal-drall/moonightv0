use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct PositionData {
    pub collateral_type: felt252,
    pub collateral_amount: u256,
    pub debt: u256,
    pub interest_rate: u256,
    pub last_update: u64,
    pub created_at: u64,
}

#[starknet::interface]
pub trait ICDPManager<TContractState> {
    fn open_position(
        ref self: TContractState,
        collateral_type: felt252,
        collateral_amount: u256,
        mint_amount: u256,
        interest_rate: u256,
    ) -> u256;
    fn close_position(ref self: TContractState, position_id: u256);
    fn deposit_collateral(ref self: TContractState, position_id: u256, amount: u256);
    fn withdraw_collateral(ref self: TContractState, position_id: u256, amount: u256);
    fn mint_more(ref self: TContractState, position_id: u256, amount: u256);
    fn repay(ref self: TContractState, position_id: u256, amount: u256);
    fn set_rate(ref self: TContractState, position_id: u256, new_rate: u256);
    fn liquidate(ref self: TContractState, position_id: u256);
    fn get_position(self: @TContractState, position_id: u256) -> PositionData;
    fn get_health_factor(self: @TContractState, position_id: u256) -> u256;
    fn get_current_debt(self: @TContractState, position_id: u256) -> u256;
    fn get_market_average_rate(self: @TContractState) -> u256;
    fn get_borrow_fee(self: @TContractState, mint_amount: u256) -> u256;
    fn get_total_debt(self: @TContractState) -> u256;
    fn get_active_positions(self: @TContractState) -> u256;
    fn add_collateral_type(
        ref self: TContractState,
        key: felt252,
        token: ContractAddress,
        ltv_max: u256,
        liq_penalty: u256,
    );
    fn set_collateral_enabled(ref self: TContractState, key: felt252, enabled: bool);
}
