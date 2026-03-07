use starknet::ContractAddress;

#[starknet::interface]
pub trait IFlashBorrower<TContractState> {
    fn on_flash_loan(
        ref self: TContractState,
        initiator: ContractAddress,
        amount: u256,
        fee: u256,
        data: Span<felt252>,
    ) -> felt252;
}
