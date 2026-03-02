/// Deployable Mock WBTC for Sepolia testnet.
/// Anyone can call `mint_to` to get test tokens.
#[starknet::contract]
pub mod MockWBTC {
    use starknet::ContractAddress;
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20MixinImpl<ContractState>;
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

    /// Open mint for testnet — anyone can mint test WBTC.
    #[external(v0)]
    fn mint_to(ref self: ContractState, to: ContractAddress, amount: u256) {
        self.erc20.mint(to, amount);
    }
}
