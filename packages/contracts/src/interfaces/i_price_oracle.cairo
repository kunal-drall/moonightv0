use starknet::ContractAddress;

#[starknet::interface]
pub trait IPriceOracle<TContractState> {
    fn get_price(self: @TContractState, collateral_type: felt252) -> (u256, u64);
    fn get_price_twap(self: @TContractState, collateral_type: felt252) -> (u256, u64);
    fn is_price_fresh(self: @TContractState, collateral_type: felt252) -> bool;
    fn is_emergency_mode(self: @TContractState) -> bool;
    fn set_pragma_address(ref self: TContractState, address: ContractAddress);
    fn set_asset_key(ref self: TContractState, collateral_type: felt252, pragma_key: felt252);
    fn set_twap_window(ref self: TContractState, window: u64);
    fn set_max_staleness(ref self: TContractState, staleness: u64);
}
