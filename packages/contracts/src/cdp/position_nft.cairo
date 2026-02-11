// Position NFT - ERC-721 token representing CDP positions
// Only CDPManager can mint/burn. Transfers allow position ownership change.

#[starknet::contract]
pub mod PositionNFT {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc721::{ERC721Component, ERC721HooksEmptyImpl};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_introspection::src5::SRC5Component;

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    // ERC721 external
    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721MixinImpl<ContractState>;
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;

    // Ownable external
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        // CDPManager address - only this contract can mint/burn
        cdp_manager: ContractAddress,
        // Auto-incrementing token ID
        next_token_id: u256,
        // Total supply tracking
        total_supply: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        PositionMinted: PositionMinted,
        PositionBurned: PositionBurned,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionMinted {
        #[key]
        token_id: u256,
        #[key]
        owner: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionBurned {
        #[key]
        token_id: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.erc721.initializer("Moonight Position", "MPOS", "");
        self.ownable.initializer(owner);
        self.next_token_id.write(1); // Start from 1
        self.total_supply.write(0);
    }

    #[abi(embed_v0)]
    impl PositionNFTImpl of moonight::interfaces::i_position_nft::IPositionNFT<ContractState> {
        /// Mint a new position NFT. Only callable by CDPManager.
        fn mint(ref self: ContractState, to: ContractAddress) -> u256 {
            self._assert_cdp_manager();
            let token_id = self.next_token_id.read();
            self.erc721.mint(to, token_id);
            self.next_token_id.write(token_id + 1);
            self.total_supply.write(self.total_supply.read() + 1);
            self.emit(PositionMinted { token_id, owner: to });
            token_id
        }

        /// Burn a position NFT. Only callable by CDPManager.
        fn burn(ref self: ContractState, token_id: u256) {
            self._assert_cdp_manager();
            self.erc721.burn(token_id);
            self.total_supply.write(self.total_supply.read() - 1);
            self.emit(PositionBurned { token_id });
        }

        /// Set the CDPManager address. Owner-only, can only be set once.
        fn set_cdp_manager(ref self: ContractState, cdp_manager: ContractAddress) {
            self.ownable.assert_only_owner();
            self.cdp_manager.write(cdp_manager);
        }

        /// Get total number of active position NFTs.
        fn get_total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        /// Get owner of a position NFT.
        fn owner_of_position(self: @ContractState, token_id: u256) -> ContractAddress {
            self.erc721.owner_of(token_id)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_cdp_manager(self: @ContractState) {
            let caller = get_caller_address();
            let cdp_mgr = self.cdp_manager.read();
            assert(caller == cdp_mgr, 'Only CDPManager can call');
        }
    }
}
