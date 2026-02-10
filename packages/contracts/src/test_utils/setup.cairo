// Test setup utilities - deploy helpers for snforge tests
use starknet::ContractAddress;
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address};
use moonight::interfaces::i_position_nft::{IPositionNFTDispatcher, IPositionNFTDispatcherTrait};
use moonight::interfaces::i_moonusd::{IMoonUSDDispatcher, IMoonUSDDispatcherTrait};
use moonight::interfaces::i_price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};
use moonight::interfaces::i_cdp_manager::{ICDPManagerDispatcher, ICDPManagerDispatcherTrait};

// Helper interface for StabilityPool admin functions not in the main trait
#[starknet::interface]
pub trait IStabilityPoolAdmin<TContractState> {
    fn set_cdp_manager(ref self: TContractState, cdp_manager: ContractAddress);
    fn set_collateral_token(ref self: TContractState, key: felt252, token: ContractAddress);
}

pub fn OWNER() -> ContractAddress {
    starknet::contract_address_const::<'OWNER'>()
}

pub fn USER1() -> ContractAddress {
    starknet::contract_address_const::<'USER1'>()
}

pub fn USER2() -> ContractAddress {
    starknet::contract_address_const::<'USER2'>()
}

pub fn TREASURY() -> ContractAddress {
    starknet::contract_address_const::<'TREASURY'>()
}

pub fn deploy_moonusd(owner: ContractAddress) -> ContractAddress {
    let contract = declare("MoonUSD").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_position_nft(owner: ContractAddress) -> ContractAddress {
    let contract = declare("PositionNFT").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_mock_erc20(name: ByteArray, symbol: ByteArray) -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut calldata = array![];
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_mock_oracle() -> ContractAddress {
    let contract = declare("MockPragmaOracle").unwrap().contract_class();
    let calldata = array![];
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_price_oracle(owner: ContractAddress, pragma_address: ContractAddress) -> ContractAddress {
    let contract = declare("PriceOracle").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    pragma_address.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_stability_pool(owner: ContractAddress, moonusd: ContractAddress) -> ContractAddress {
    let contract = declare("StabilityPool").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    moonusd.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_redemption_manager(
    owner: ContractAddress, moonusd: ContractAddress, oracle: ContractAddress,
) -> ContractAddress {
    let contract = declare("RedemptionManager").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    moonusd.serialize(ref calldata);
    oracle.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_protocol_config(owner: ContractAddress, treasury: ContractAddress) -> ContractAddress {
    let contract = declare("ProtocolConfig").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    treasury.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

pub fn deploy_cdp_manager(
    owner: ContractAddress,
    moonusd: ContractAddress,
    position_nft: ContractAddress,
    price_oracle: ContractAddress,
    stability_pool: ContractAddress,
    redemption_manager: ContractAddress,
    protocol_config: ContractAddress,
    treasury: ContractAddress,
) -> ContractAddress {
    let contract = declare("CDPManager").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    moonusd.serialize(ref calldata);
    position_nft.serialize(ref calldata);
    price_oracle.serialize(ref calldata);
    stability_pool.serialize(ref calldata);
    redemption_manager.serialize(ref calldata);
    protocol_config.serialize(ref calldata);
    treasury.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

/// Deploy the full protocol stack and wire everything together.
/// Returns (moonusd, position_nft, cdp_manager, stability_pool, redemption_manager, price_oracle, protocol_config, mock_oracle, mock_wbtc)
pub fn deploy_full_protocol() -> (
    ContractAddress, ContractAddress, ContractAddress, ContractAddress,
    ContractAddress, ContractAddress, ContractAddress, ContractAddress,
    ContractAddress,
) {
    let owner = OWNER();
    let treasury = TREASURY();

    // Deploy tokens
    let moonusd = deploy_moonusd(owner);
    let mock_wbtc = deploy_mock_erc20("Wrapped BTC", "WBTC");

    // Deploy mock oracle and price oracle
    let mock_oracle_addr = deploy_mock_oracle();
    let price_oracle = deploy_price_oracle(owner, mock_oracle_addr);

    // Deploy pools
    let stability_pool = deploy_stability_pool(owner, moonusd);
    let redemption_manager = deploy_redemption_manager(owner, moonusd, price_oracle);
    let protocol_config = deploy_protocol_config(owner, treasury);

    // Deploy NFT and CDP manager
    let position_nft = deploy_position_nft(owner);
    let cdp_manager = deploy_cdp_manager(
        owner, moonusd, position_nft, price_oracle,
        stability_pool, redemption_manager, protocol_config, treasury,
    );

    // Wire up permissions
    // Set CDPManager on PositionNFT
    start_cheat_caller_address(position_nft, owner);
    IPositionNFTDispatcher { contract_address: position_nft }.set_cdp_manager(cdp_manager);

    // Add CDPManager as minter and burner on moonUSD
    start_cheat_caller_address(moonusd, owner);
    let moonusd_d = IMoonUSDDispatcher { contract_address: moonusd };
    moonusd_d.add_minter(cdp_manager);
    moonusd_d.add_burner(cdp_manager);
    moonusd_d.add_burner(stability_pool);

    // Set CDPManager on StabilityPool (using admin dispatcher for external fn)
    start_cheat_caller_address(stability_pool, owner);
    IStabilityPoolAdminDispatcher { contract_address: stability_pool }
        .set_cdp_manager(cdp_manager);

    // Set asset key on price oracle (WBTC key)
    start_cheat_caller_address(price_oracle, owner);
    let oracle_d = IPriceOracleDispatcher { contract_address: price_oracle };
    oracle_d.set_asset_key('WBTC', 'WBTC/USD');

    // Add WBTC as collateral type on CDPManager
    start_cheat_caller_address(cdp_manager, owner);
    ICDPManagerDispatcher { contract_address: cdp_manager }
        .add_collateral_type('WBTC', mock_wbtc, 8000, 500); // 80% LTV, 5% penalty

    (moonusd, position_nft, cdp_manager, stability_pool, redemption_manager, price_oracle, protocol_config, mock_oracle_addr, mock_wbtc)
}
