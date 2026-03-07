// Redemption Manager - Sorted queue by interest rate + redemption fee model
// Positions sorted ascending by rate (lowest rate = redeemed first)

#[starknet::contract]
pub mod RedemptionManager {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use moonight::math::fixed_point::{SCALE, BPS_SCALE};
    use moonight::math::exp;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        cdp_manager: ContractAddress,
        moonusd_token: ContractAddress,
        price_oracle: ContractAddress,
        // Sorted doubly-linked list
        sorted_head: u256,
        sorted_tail: u256,
        sorted_next: Map<u256, u256>,
        sorted_prev: Map<u256, u256>,
        sorted_rate: Map<u256, u256>,
        sorted_size: u256,
        // Base rate for redemption fee
        base_rate: u256,
        last_fee_operation_time: u64,
        // Constants
        decay_lambda: u256,
        alpha: u256,
        min_fee_bps: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Redeemed: Redeemed,
    }

    #[derive(Drop, starknet::Event)]
    struct Redeemed {
        moonusd_amount: u256,
        collateral_received: u256,
        fee: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        moonusd_token: ContractAddress,
        price_oracle: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.moonusd_token.write(moonusd_token);
        self.price_oracle.write(price_oracle);
        self.base_rate.write(0);
        self.last_fee_operation_time.write(get_block_timestamp());
        // lambda = 0.5 per hour in 18-decimal per-hour units
        self.decay_lambda.write(SCALE / 2);
        // alpha = 0.5
        self.alpha.write(SCALE / 2);
        // min fee = 0.5% = 50 bps
        self.min_fee_bps.write(50);
    }

    #[abi(embed_v0)]
    impl RedemptionManagerImpl of moonight::interfaces::i_redemption_manager::IRedemptionManager<ContractState> {
        fn redeem(ref self: ContractState, moonusd_amount: u256) -> u256 {
            // Simplified redemption logic
            assert(moonusd_amount > 0, 'Zero redemption');

            // Decay base rate
            let now = get_block_timestamp();
            let last_time = self.last_fee_operation_time.read();
            let dt = now - last_time;
            let decayed_rate = exp::exp_decay(self.base_rate.read(), self.decay_lambda.read(), dt);
            self.base_rate.write(decayed_rate);
            self.last_fee_operation_time.write(now);

            // Calculate fee
            let fee_rate = self._get_redemption_fee_rate();

            self.emit(Redeemed { moonusd_amount, collateral_received: 0, fee: fee_rate });

            0 // Simplified - full implementation traverses queue
        }

        fn insert(ref self: ContractState, position_id: u256, interest_rate: u256) {
            let caller = get_caller_address();
            assert(caller == self.cdp_manager.read(), 'Only CDPManager');
            self.sorted_rate.write(position_id, interest_rate);
            let size = self.sorted_size.read();

            if size == 0 {
                self.sorted_head.write(position_id);
                self.sorted_tail.write(position_id);
                self.sorted_next.write(position_id, 0);
                self.sorted_prev.write(position_id, 0);
            } else {
                // Find insertion point (ascending order by rate)
                let mut current = self.sorted_head.read();
                let mut found = false;

                loop {
                    if current == 0 { break; }
                    let current_rate = self.sorted_rate.read(current);
                    if interest_rate <= current_rate {
                        // Insert before current
                        let prev = self.sorted_prev.read(current);
                        self.sorted_next.write(position_id, current);
                        self.sorted_prev.write(position_id, prev);
                        self.sorted_prev.write(current, position_id);
                        if prev != 0 {
                            self.sorted_next.write(prev, position_id);
                        } else {
                            self.sorted_head.write(position_id);
                        }
                        found = true;
                        break;
                    }
                    current = self.sorted_next.read(current);
                };

                if !found {
                    // Insert at tail
                    let tail = self.sorted_tail.read();
                    self.sorted_next.write(tail, position_id);
                    self.sorted_prev.write(position_id, tail);
                    self.sorted_next.write(position_id, 0);
                    self.sorted_tail.write(position_id);
                }
            }

            self.sorted_size.write(size + 1);
        }

        fn remove(ref self: ContractState, position_id: u256) {
            let caller = get_caller_address();
            assert(caller == self.cdp_manager.read(), 'Only CDPManager');
            let prev = self.sorted_prev.read(position_id);
            let next = self.sorted_next.read(position_id);

            if prev != 0 {
                self.sorted_next.write(prev, next);
            } else {
                self.sorted_head.write(next);
            }

            if next != 0 {
                self.sorted_prev.write(next, prev);
            } else {
                self.sorted_tail.write(prev);
            }

            self.sorted_next.write(position_id, 0);
            self.sorted_prev.write(position_id, 0);
            self.sorted_rate.write(position_id, 0);

            let size = self.sorted_size.read();
            if size > 0 {
                self.sorted_size.write(size - 1);
            }
        }

        fn re_insert(ref self: ContractState, position_id: u256, new_rate: u256) {
            let caller = get_caller_address();
            assert(caller == self.cdp_manager.read(), 'Only CDPManager');
            // Internal calls preserve caller context in Starknet
            self.remove(position_id);
            self.insert(position_id, new_rate);
        }

        fn get_redemption_fee(self: @ContractState) -> u256 {
            self._get_redemption_fee_rate()
        }

        fn get_base_rate(self: @ContractState) -> u256 {
            self.base_rate.read()
        }

        fn get_sorted_head(self: @ContractState) -> u256 {
            self.sorted_head.read()
        }

        fn get_queue_size(self: @ContractState) -> u256 {
            self.sorted_size.read()
        }
    }

    #[external(v0)]
    fn set_cdp_manager(ref self: ContractState, cdp_manager: ContractAddress) {
        self.ownable.assert_only_owner();
        self.cdp_manager.write(cdp_manager);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_redemption_fee_rate(self: @ContractState) -> u256 {
            let base = self.base_rate.read();
            let min_fee = self.min_fee_bps.read() * SCALE / BPS_SCALE;
            let fee = base + 50 * SCALE / BPS_SCALE; // base_rate + 0.5%
            if fee < min_fee { min_fee } else { fee }
        }
    }
}
