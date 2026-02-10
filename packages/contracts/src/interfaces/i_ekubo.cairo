use starknet::ContractAddress;

#[starknet::interface]
pub trait IEkuboRouter<TContractState> {
    fn swap(
        ref self: TContractState,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        min_amount_out: u256,
    ) -> u256;
    fn add_liquidity(
        ref self: TContractState,
        token_a: ContractAddress,
        token_b: ContractAddress,
        amount_a: u256,
        amount_b: u256,
    ) -> u256;
    fn remove_liquidity(
        ref self: TContractState,
        token_a: ContractAddress,
        token_b: ContractAddress,
        liquidity: u256,
    ) -> (u256, u256);
}
