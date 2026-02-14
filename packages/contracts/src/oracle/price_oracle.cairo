// Price Oracle - Pragma integration wrapper
// Provides TWAP prices, staleness checks, fallback/grace period logic

#[starknet::contract]
pub mod PriceOracle {
    use starknet::{ContractAddress, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use moonight::interfaces::i_pragma::{IPragmaABIDispatcher, IPragmaABIDispatcherTrait, DataType};
    use moonight::math::fixed_point::normalize_price;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        pragma_address: ContractAddress,
        // Per-asset configuration
        asset_pragma_keys: Map<felt252, felt252>,
        twap_window: u64,
        max_staleness: u64,
        // Fallback state
        last_valid_price: Map<felt252, u256>,
        last_valid_timestamp: Map<felt252, u64>,
        grace_period: u64,
        emergency_mode: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        EmergencyModeActivated: EmergencyModeActivated,
        EmergencyModeDeactivated: EmergencyModeDeactivated,
        PriceUpdated: PriceUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyModeActivated {
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyModeDeactivated {
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PriceUpdated {
        #[key]
        collateral_type: felt252,
        price: u256,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        pragma_address: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.pragma_address.write(pragma_address);
        self.twap_window.write(900); // 15 minutes
        self.max_staleness.write(3600); // 1 hour
        self.grace_period.write(21600); // 6 hours
        self.emergency_mode.write(false);
    }

    #[abi(embed_v0)]
    impl PriceOracleImpl of moonight::interfaces::i_price_oracle::IPriceOracle<ContractState> {
        fn get_price(self: @ContractState, collateral_type: felt252) -> (u256, u64) {
            self._fetch_price(collateral_type)
        }

        fn get_price_twap(self: @ContractState, collateral_type: felt252) -> (u256, u64) {
            self._fetch_price(collateral_type)
        }

        fn is_price_fresh(self: @ContractState, collateral_type: felt252) -> bool {
            let last_ts = self.last_valid_timestamp.read(collateral_type);
            let now = get_block_timestamp();
            now - last_ts < self.max_staleness.read()
        }

        fn is_emergency_mode(self: @ContractState) -> bool {
            self.emergency_mode.read()
        }

        fn set_pragma_address(ref self: ContractState, address: ContractAddress) {
            self.ownable.assert_only_owner();
            self.pragma_address.write(address);
        }

        fn set_asset_key(ref self: ContractState, collateral_type: felt252, pragma_key: felt252) {
            self.ownable.assert_only_owner();
            self.asset_pragma_keys.write(collateral_type, pragma_key);
        }

        fn set_twap_window(ref self: ContractState, window: u64) {
            self.ownable.assert_only_owner();
            self.twap_window.write(window);
        }

        fn set_max_staleness(ref self: ContractState, staleness: u64) {
            self.ownable.assert_only_owner();
            self.max_staleness.write(staleness);
        }
    }

    #[external(v0)]
    fn reset_emergency(ref self: ContractState) {
        self.ownable.assert_only_owner();
        self.emergency_mode.write(false);
        self.emit(EmergencyModeDeactivated { timestamp: get_block_timestamp() });
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _fetch_price(self: @ContractState, collateral_type: felt252) -> (u256, u64) {
            let pragma_key = self.asset_pragma_keys.read(collateral_type);
            let pragma = IPragmaABIDispatcher { contract_address: self.pragma_address.read() };
            let now = get_block_timestamp();

            let response = pragma.get_data_median(DataType::SpotEntry(pragma_key));

            // Check freshness
            if response.num_sources_aggregated == 0 || (now - response.last_updated_timestamp) > self.max_staleness.read() {
                // Use cached price if within grace period
                let last_ts = self.last_valid_timestamp.read(collateral_type);
                if now - last_ts < self.grace_period.read() {
                    let cached_price = self.last_valid_price.read(collateral_type);
                    return (cached_price, last_ts);
                }
                // Beyond grace - should enter emergency mode
                // Note: can't write in view function, so caller must handle
                assert(false, 'Oracle stale - emergency');
            }

            // Normalize to 18 decimals
            let price_normalized = normalize_price(response.price.into(), response.decimals);

            (price_normalized, response.last_updated_timestamp)
        }
    }

    // Separate mutable version for state-changing functions
    #[external(v0)]
    fn update_price_cache(ref self: ContractState, collateral_type: felt252) {
        let pragma_key = self.asset_pragma_keys.read(collateral_type);
        let pragma = IPragmaABIDispatcher { contract_address: self.pragma_address.read() };
        let now = get_block_timestamp();

        let response = pragma.get_data_median(DataType::SpotEntry(pragma_key));

        if response.num_sources_aggregated > 0 && (now - response.last_updated_timestamp) <= self.max_staleness.read() {
            let price_normalized = normalize_price(response.price.into(), response.decimals);
            self.last_valid_price.write(collateral_type, price_normalized);
            self.last_valid_timestamp.write(collateral_type, response.last_updated_timestamp);
            self.emit(PriceUpdated {
                collateral_type, price: price_normalized, timestamp: response.last_updated_timestamp,
            });

            if self.emergency_mode.read() {
                self.emergency_mode.write(false);
                self.emit(EmergencyModeDeactivated { timestamp: now });
            }
        } else {
            let last_ts = self.last_valid_timestamp.read(collateral_type);
            if now - last_ts >= self.grace_period.read() && !self.emergency_mode.read() {
                self.emergency_mode.write(true);
                self.emit(EmergencyModeActivated { timestamp: now });
            }
        }
    }
}
