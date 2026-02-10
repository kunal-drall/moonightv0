#[derive(Copy, Drop, Serde)]
pub struct PragmaPricesResponse {
    pub price: u128,
    pub decimals: u32,
    pub last_updated_timestamp: u64,
    pub num_sources_aggregated: u32,
}

#[derive(Copy, Drop, Serde)]
pub enum DataType {
    SpotEntry: felt252,
    FutureEntry: (felt252, u64),
}

#[starknet::interface]
pub trait IPragmaABI<TContractState> {
    fn get_data_median(self: @TContractState, data_type: DataType) -> PragmaPricesResponse;
}
