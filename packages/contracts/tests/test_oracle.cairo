use starknet::ContractAddress;
use snforge_std::start_cheat_caller_address;
use moonight::test_utils::setup::{
    OWNER, deploy_mock_oracle, deploy_price_oracle,
};
use moonight::interfaces::i_price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};

const SCALE: u256 = 1_000_000_000_000_000_000;

fn setup() -> (ContractAddress, IPriceOracleDispatcher) {
    let owner = OWNER();
    let mock_pragma = deploy_mock_oracle();
    let oracle_addr = deploy_price_oracle(owner, mock_pragma);
    let oracle = IPriceOracleDispatcher { contract_address: oracle_addr };

    // Configure asset key
    start_cheat_caller_address(oracle_addr, owner);
    oracle.set_asset_key('WBTC', 'WBTC/USD');
    oracle.set_max_staleness(3600); // 1 hour

    (oracle_addr, oracle)
}

// ==========================================================================
// Price Queries
// ==========================================================================

#[test]
fn test_oracle_get_price() {
    let (_, oracle) = setup();
    let (price, _timestamp) = oracle.get_price('WBTC');
    // Mock oracle should return a price > 0
    assert(price > 0, 'Price should be > 0');
}

#[test]
fn test_oracle_get_price_twap() {
    let (_, oracle) = setup();
    let (twap_price, _timestamp) = oracle.get_price_twap('WBTC');
    // TWAP should also return a price > 0
    assert(twap_price > 0, 'TWAP should be > 0');
}

// ==========================================================================
// Staleness
// ==========================================================================

#[test]
fn test_oracle_price_freshness() {
    let (_, oracle) = setup();
    let fresh = oracle.is_price_fresh('WBTC');
    // Mock oracle should report fresh prices
    assert(fresh == true, 'Price should be fresh');
}

// ==========================================================================
// Emergency Mode
// ==========================================================================

#[test]
fn test_oracle_not_in_emergency() {
    let (_, oracle) = setup();
    let emergency = oracle.is_emergency_mode();
    assert(emergency == false, 'Should not be in emergency mode');
}

// ==========================================================================
// Admin
// ==========================================================================

#[test]
fn test_oracle_set_twap_window() {
    let (oracle_addr, oracle) = setup();
    let owner = OWNER();

    start_cheat_caller_address(oracle_addr, owner);
    oracle.set_twap_window(7200); // 2 hours

    // If no panic, the call succeeded
}

#[test]
fn test_oracle_set_max_staleness() {
    let (oracle_addr, oracle) = setup();
    let owner = OWNER();

    start_cheat_caller_address(oracle_addr, owner);
    oracle.set_max_staleness(1800); // 30 minutes
}
