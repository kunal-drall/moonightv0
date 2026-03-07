/// Deployable Mock WBTC for Sepolia testnet (8 decimals, matching real BTC).
/// Anyone can call `mint_to` to get test tokens.
#[starknet::contract]
pub mod MockWBTC {
    use starknet::ContractAddress;
    use starknet::storage::StoragePointerReadAccess;
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_token::erc20::interface::IERC20Metadata;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    // Embed core ERC20 + camel case impls (but NOT metadata — we override decimals)
    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20CamelOnlyImpl = ERC20Component::ERC20CamelOnlyImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.erc20.initializer("Wrapped BTC", "WBTC");
    }

    // Custom metadata: 8 decimals to match real BTC/WBTC
    #[abi(embed_v0)]
    impl ERC20MetadataImpl of IERC20Metadata<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_name.read()
        }
        fn symbol(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_symbol.read()
        }
        fn decimals(self: @ContractState) -> u8 {
            8
        }
    }

    /// Open mint for testnet — anyone can mint test WBTC.
    #[external(v0)]
    fn mint_to(ref self: ContractState, to: ContractAddress, amount: u256) {
        self.erc20.mint(to, amount);
    }
}
