// Protocol Configuration - Global parameters and contract registry

#[starknet::contract]
pub mod ProtocolConfig {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_access::ownable::OwnableComponent;
    use moonight::math::fixed_point::SCALE;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Contract registry
        moonusd_token: ContractAddress,
        cdp_manager: ContractAddress,
        position_nft: ContractAddress,
        stability_pool: ContractAddress,
        redemption_manager: ContractAddress,
        price_oracle: ContractAddress,
        vault_a: ContractAddress,
        vault_c: ContractAddress,
        treasury: ContractAddress,
        // Global parameters
        min_debt: u256,
        borrow_fee_days: u256,
        rate_cooldown_seconds: u64,
        min_rate_bps: u256,
        max_rate_bps: u256,
        sp_interest_share_bps: u256,
        treasury_interest_share_bps: u256,
        min_hf_after_withdrawal: u256,
        // Emergency
        guardian: ContractAddress,
        emergency_mode: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, treasury: ContractAddress) {
        self.ownable.initializer(owner);
        self.treasury.write(treasury);
        // Set defaults
        self.min_debt.write(200 * SCALE); // 200 moonUSD
        self.borrow_fee_days.write(7);
        self.rate_cooldown_seconds.write(43200); // 12 hours
        self.min_rate_bps.write(50); // 0.5%
        self.max_rate_bps.write(50000); // 500%
        self.sp_interest_share_bps.write(7500); // 75%
        self.treasury_interest_share_bps.write(2500); // 25%
        self.min_hf_after_withdrawal.write(SCALE * 11 / 10); // 1.1
        self.emergency_mode.write(false);
    }

    #[abi(embed_v0)]
    impl ProtocolConfigImpl of moonight::interfaces::i_protocol_config::IProtocolConfig<ContractState> {
        fn get_min_debt(self: @ContractState) -> u256 { self.min_debt.read() }
        fn get_borrow_fee_days(self: @ContractState) -> u256 { self.borrow_fee_days.read() }
        fn get_rate_cooldown_seconds(self: @ContractState) -> u64 { self.rate_cooldown_seconds.read() }
        fn get_min_rate_bps(self: @ContractState) -> u256 { self.min_rate_bps.read() }
        fn get_max_rate_bps(self: @ContractState) -> u256 { self.max_rate_bps.read() }
        fn get_sp_interest_share_bps(self: @ContractState) -> u256 { self.sp_interest_share_bps.read() }
        fn get_treasury_interest_share_bps(self: @ContractState) -> u256 { self.treasury_interest_share_bps.read() }
        fn get_min_hf_after_withdrawal(self: @ContractState) -> u256 { self.min_hf_after_withdrawal.read() }
        fn get_treasury(self: @ContractState) -> ContractAddress { self.treasury.read() }
        fn get_guardian(self: @ContractState) -> ContractAddress { self.guardian.read() }
        fn is_emergency_mode(self: @ContractState) -> bool { self.emergency_mode.read() }

        fn set_min_debt(ref self: ContractState, value: u256) {
            self.ownable.assert_only_owner();
            self.min_debt.write(value);
        }
        fn set_treasury(ref self: ContractState, address: ContractAddress) {
            self.ownable.assert_only_owner();
            self.treasury.write(address);
        }
        fn set_guardian(ref self: ContractState, address: ContractAddress) {
            self.ownable.assert_only_owner();
            self.guardian.write(address);
        }
        fn set_emergency_mode(ref self: ContractState, mode: bool) {
            self.ownable.assert_only_owner();
            self.emergency_mode.write(mode);
        }
    }
}
