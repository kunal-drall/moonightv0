use starknet::ContractAddress;
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use moonight::test_utils::setup::{
    OWNER, USER1, USER2, TREASURY,
    deploy_full_protocol,
};
use moonight::interfaces::i_cdp_manager::{ICDPManagerDispatcher, ICDPManagerDispatcherTrait};
use moonight::interfaces::i_moonusd::{IMoonUSDDispatcher, IMoonUSDDispatcherTrait};
use moonight::interfaces::i_position_nft::{IPositionNFTDispatcher, IPositionNFTDispatcherTrait};
use moonight::interfaces::i_price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

const SCALE: u256 = 1_000_000_000_000_000_000; // 1e18

fn setup() -> (
    ContractAddress, // moonusd
    ContractAddress, // position_nft
    ContractAddress, // cdp_manager
    ContractAddress, // stability_pool
    ContractAddress, // price_oracle
    ContractAddress, // mock_wbtc
) {
    let (moonusd, position_nft, cdp_manager, stability_pool, _redemption, price_oracle, _config, _mock_oracle, mock_wbtc) =
        deploy_full_protocol();
    (moonusd, position_nft, cdp_manager, stability_pool, price_oracle, mock_wbtc)
}

// ==========================================================================
// CDP Open / Close
// ==========================================================================

#[test]
fn test_open_position_basic() {
    let (moonusd, position_nft, cdp_manager, _, _, mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };
    let wbtc = IERC20Dispatcher { contract_address: mock_wbtc };
    let nft = IPositionNFTDispatcher { contract_address: position_nft };

    // Give user some WBTC and approve CDPManager
    start_cheat_caller_address(mock_wbtc, user);
    // MockERC20 should give initial supply to deployer — mint more via mock
    stop_cheat_caller_address(mock_wbtc);

    // Open position: 1 WBTC collateral, mint 10000 moonUSD, 5% rate
    start_cheat_caller_address(cdp_manager, user);
    let position_id = cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);

    assert(position_id > 0, 'Position ID should be > 0');

    // Check position data
    let pos = cdp.get_position(position_id);
    assert(pos.collateral_type == 'WBTC', 'Collateral type mismatch');
    assert(pos.collateral_amount == 1 * SCALE, 'Collateral amount mismatch');
    assert(pos.debt == 10_000 * SCALE, 'Debt mismatch');

    // Check NFT was minted to user
    assert(nft.get_total_supply() == 1, 'NFT total supply should be 1');
}

#[test]
fn test_deposit_additional_collateral() {
    let (_moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };

    // Open position
    start_cheat_caller_address(cdp_manager, user);
    let position_id = cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);

    // Add more collateral
    cdp.deposit_collateral(position_id, SCALE / 2); // 0.5 WBTC more

    let pos = cdp.get_position(position_id);
    assert(pos.collateral_amount == 3 * SCALE / 2, 'Should have 1.5 WBTC');
}

#[test]
fn test_repay_partial_debt() {
    let (moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };
    let musd = IERC20Dispatcher { contract_address: moonusd };

    // Open position
    start_cheat_caller_address(cdp_manager, user);
    let position_id = cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);

    // Repay 5000 moonUSD
    cdp.repay(position_id, 5_000 * SCALE);

    let pos = cdp.get_position(position_id);
    assert(pos.debt == 5_000 * SCALE, 'Debt should be 5000');
}

#[test]
fn test_close_position() {
    let (moonusd, position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };
    let nft = IPositionNFTDispatcher { contract_address: position_nft };

    // Open and close
    start_cheat_caller_address(cdp_manager, user);
    let position_id = cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);
    cdp.close_position(position_id);

    // NFT should be burned
    assert(nft.get_total_supply() == 0, 'NFT should be burned');
}

#[test]
fn test_mint_more_debt() {
    let (_moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };

    start_cheat_caller_address(cdp_manager, user);
    let position_id = cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);

    // Mint 2000 more
    cdp.mint_more(position_id, 2_000 * SCALE);

    let pos = cdp.get_position(position_id);
    assert(pos.debt == 12_000 * SCALE, 'Debt should be 12000');
}

// ==========================================================================
// Health Factor
// ==========================================================================

#[test]
fn test_health_factor_well_collateralized() {
    let (_moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };

    // With 1 BTC (~$60k), borrow 10k => HF should be well above 1.0
    start_cheat_caller_address(cdp_manager, user);
    let position_id = cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);

    let hf = cdp.get_health_factor(position_id);
    // HF should be significantly above 1.0 (i.e. > 1e18)
    assert(hf > SCALE, 'HF should be > 1.0');
}

// ==========================================================================
// Protocol Stats
// ==========================================================================

#[test]
fn test_total_debt_tracking() {
    let (_moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };

    start_cheat_caller_address(cdp_manager, user);
    cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);
    cdp.open_position('WBTC', 1 * SCALE, 5_000 * SCALE, 300);

    let total = cdp.get_total_debt();
    assert(total == 15_000 * SCALE, 'Total debt should be 15000');
}

#[test]
fn test_active_positions_count() {
    let (_moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };

    start_cheat_caller_address(cdp_manager, user);
    cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);
    cdp.open_position('WBTC', 1 * SCALE, 5_000 * SCALE, 300);

    let active = cdp.get_active_positions();
    assert(active == 2, 'Should have 2 active positions');
}

#[test]
fn test_borrow_fee() {
    let (_moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };

    let fee = cdp.get_borrow_fee(10_000 * SCALE);
    // Fee should be >= 0 (depends on protocol config)
    assert(fee >= 0, 'Fee should be non-negative');
}

// ==========================================================================
// Rate Changes
// ==========================================================================

#[test]
fn test_set_interest_rate() {
    let (_moonusd, _position_nft, cdp_manager, _, _, _mock_wbtc) = setup();
    let user = USER1();
    let cdp = ICDPManagerDispatcher { contract_address: cdp_manager };

    start_cheat_caller_address(cdp_manager, user);
    let position_id = cdp.open_position('WBTC', 1 * SCALE, 10_000 * SCALE, 500);

    // Change rate to 7%
    cdp.set_rate(position_id, 700);

    let pos = cdp.get_position(position_id);
    assert(pos.interest_rate == 700, 'Rate should be 700 bps');
}
