use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
pub struct VaultAStats {
    pub total_shares: u256,
    pub nav: u256,
    pub nav_per_share: u256,
    pub long_notional: u256,
    pub short_notional: u256,
    pub accrued_funding: u256,
    pub current_direction: felt252,
}

#[derive(Copy, Drop, Serde)]
pub struct UserVaultPosition {
    pub shares: u256,
    pub usd_value: u256,
    pub entry_nav_per_share: u256,
}

#[starknet::interface]
pub trait IVaultA<TContractState> {
    fn deposit_btc(ref self: TContractState, btc_amount: u256, collateral_type: felt252) -> u256;
    fn deposit_usdc(ref self: TContractState, usdc_amount: u256) -> u256;
    fn withdraw(ref self: TContractState, share_amount: u256);
    fn trigger_flip(ref self: TContractState, new_direction: felt252);
    fn emergency_rebalance(ref self: TContractState);
    fn harvest_funding(ref self: TContractState);
    fn get_nav(self: @TContractState) -> u256;
    fn get_nav_per_share(self: @TContractState) -> u256;
    fn get_delta(self: @TContractState) -> u256;
    fn get_vault_stats(self: @TContractState) -> VaultAStats;
    fn get_user_position(self: @TContractState, user: ContractAddress) -> UserVaultPosition;
}
