// Mock Pragma oracle for testing
#[starknet::contract]
pub mod MockPragmaOracle {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use moonight::interfaces::i_pragma::{PragmaPricesResponse, DataType};

    #[storage]
    struct Storage {
        prices: Map<felt252, u128>,
        decimals: Map<felt252, u32>,
        timestamps: Map<felt252, u64>,
        num_sources: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.num_sources.write(5);
    }

    #[external(v0)]
    fn set_price(ref self: ContractState, key: felt252, price: u128, decimals: u32, timestamp: u64) {
        self.prices.write(key, price);
        self.decimals.write(key, decimals);
        self.timestamps.write(key, timestamp);
    }

    #[external(v0)]
    fn set_num_sources(ref self: ContractState, n: u32) {
        self.num_sources.write(n);
    }

    #[abi(embed_v0)]
    impl MockPragmaImpl of moonight::interfaces::i_pragma::IPragmaABI<ContractState> {
        fn get_data_median(self: @ContractState, data_type: DataType) -> PragmaPricesResponse {
            let key = match data_type {
                DataType::SpotEntry(k) => k,
                DataType::FutureEntry((k, _)) => k,
            };
            PragmaPricesResponse {
                price: self.prices.read(key),
                decimals: self.decimals.read(key),
                last_updated_timestamp: self.timestamps.read(key),
                num_sources_aggregated: self.num_sources.read(),
            }
        }
    }
}
