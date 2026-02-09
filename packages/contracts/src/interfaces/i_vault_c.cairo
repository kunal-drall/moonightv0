use starknet::ContractAddress;

#[starknet::interface]
pub trait IVaultC<TContractState> {
    // ERC-4626 standard
    fn asset(self: @TContractState) -> ContractAddress;
    fn total_assets(self: @TContractState) -> u256;
    fn convert_to_shares(self: @TContractState, assets: u256) -> u256;
    fn convert_to_assets(self: @TContractState, shares: u256) -> u256;
    fn max_deposit(self: @TContractState, receiver: ContractAddress) -> u256;
    fn preview_deposit(self: @TContractState, assets: u256) -> u256;
    fn deposit_assets(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn max_withdraw(self: @TContractState, owner: ContractAddress) -> u256;
    fn preview_withdraw(self: @TContractState, assets: u256) -> u256;
    fn withdraw_assets(
        ref self: TContractState, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
    fn max_redeem(self: @TContractState, owner: ContractAddress) -> u256;
    fn preview_redeem(self: @TContractState, shares: u256) -> u256;
    fn redeem(
        ref self: TContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
    // Moonight extensions
    fn deposit_usdc(ref self: TContractState, usdc_amount: u256, receiver: ContractAddress) -> u256;
    fn compound(ref self: TContractState);
    fn reallocate(ref self: TContractState, new_weights: Array<u256>);
    fn get_allocation(self: @TContractState) -> (u256, u256, u256);
    fn get_effective_apy(self: @TContractState) -> u256;
    fn get_price_per_share(self: @TContractState) -> u256;
}
