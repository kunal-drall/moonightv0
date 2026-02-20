use starknet::ContractAddress;
use snforge_std::start_cheat_caller_address;
use moonight::test_utils::setup::{
    OWNER, USER1, USER2, TREASURY,
    deploy_moonusd, deploy_stability_pool, deploy_mock_erc20,
};
use moonight::interfaces::i_moonusd::{IMoonUSDDispatcher, IMoonUSDDispatcherTrait};
use moonight::interfaces::i_vault_c::{IVaultCDispatcher, IVaultCDispatcherTrait};
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};

const SCALE: u256 = 1_000_000_000_000_000_000;

fn deploy_vault_c(
    owner: ContractAddress,
    moonusd: ContractAddress,
    usdc: ContractAddress,
    sp: ContractAddress,
) -> ContractAddress {
    let contract = declare("VaultC").unwrap().contract_class();
    let mut calldata = array![];
    owner.serialize(ref calldata);
    moonusd.serialize(ref calldata);
    usdc.serialize(ref calldata);
    sp.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn setup() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let owner = OWNER();
    let moonusd = deploy_moonusd(owner);
    let usdc = deploy_mock_erc20("USD Coin", "USDC");
    let sp = deploy_stability_pool(owner, moonusd);
    let vault_c = deploy_vault_c(owner, moonusd, usdc, sp);

    // Add vault_c as minter for moonUSD (so we can test with minted tokens)
    start_cheat_caller_address(moonusd, owner);
    IMoonUSDDispatcher { contract_address: moonusd }.add_minter(owner);

    (moonusd, usdc, sp, vault_c)
}

fn mint_moonusd_to(moonusd: ContractAddress, to: ContractAddress, amount: u256) {
    let owner = OWNER();
    start_cheat_caller_address(moonusd, owner);
    IMoonUSDDispatcher { contract_address: moonusd }.mint(to, amount);
}

// ==========================================================================
// ERC-4626 Views
// ==========================================================================

#[test]
fn test_vault_c_asset() {
    let (moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };
    assert(vault.asset() == moonusd, 'Asset should be moonUSD');
}

#[test]
fn test_vault_c_initial_state() {
    let (_moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };

    assert(vault.total_assets() == 0, 'Initial total assets should be 0');
    assert(vault.get_price_per_share() == SCALE, 'Initial PPS should be 1.0');
}

#[test]
fn test_vault_c_allocation_defaults() {
    let (_moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };

    let (sp_weight, ekubo_weight, lz_weight) = vault.get_allocation();
    assert(sp_weight == 5600, 'SP should be 56%');
    assert(ekubo_weight == 2900, 'Ekubo should be 29%');
    assert(lz_weight == 1500, 'LZ should be 15%');
}

// ==========================================================================
// Deposit / Withdraw
// ==========================================================================

#[test]
fn test_vault_c_deposit() {
    let (moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };
    let user = USER1();

    // Mint moonUSD to user
    mint_moonusd_to(moonusd, user, 1000 * SCALE);

    // Approve and deposit
    let erc20 = IERC20Dispatcher { contract_address: moonusd };
    start_cheat_caller_address(moonusd, user);
    erc20.approve(vault_c, 1000 * SCALE);

    start_cheat_caller_address(vault_c, user);
    let shares = vault.deposit_assets(1000 * SCALE, user);

    // First deposit: 1:1 shares
    assert(shares == 1000 * SCALE, 'Should get 1000 shares');
    assert(vault.total_assets() == 1000 * SCALE, 'Total assets should be 1000');
}

#[test]
fn test_vault_c_deposit_second_user() {
    let (moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };
    let user1 = USER1();
    let user2 = USER2();

    // User1 deposits 1000
    mint_moonusd_to(moonusd, user1, 1000 * SCALE);
    let erc20 = IERC20Dispatcher { contract_address: moonusd };
    start_cheat_caller_address(moonusd, user1);
    erc20.approve(vault_c, 1000 * SCALE);
    start_cheat_caller_address(vault_c, user1);
    vault.deposit_assets(1000 * SCALE, user1);

    // User2 deposits 500
    mint_moonusd_to(moonusd, user2, 500 * SCALE);
    start_cheat_caller_address(moonusd, user2);
    erc20.approve(vault_c, 500 * SCALE);
    start_cheat_caller_address(vault_c, user2);
    let shares = vault.deposit_assets(500 * SCALE, user2);

    // At 1:1 ratio, should get 500 shares
    assert(shares == 500 * SCALE, 'Should get 500 shares');
    assert(vault.total_assets() == 1500 * SCALE, 'Total assets should be 1500');
}

#[test]
fn test_vault_c_withdraw() {
    let (moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };
    let user = USER1();

    // Deposit
    mint_moonusd_to(moonusd, user, 1000 * SCALE);
    let erc20 = IERC20Dispatcher { contract_address: moonusd };
    start_cheat_caller_address(moonusd, user);
    erc20.approve(vault_c, 1000 * SCALE);
    start_cheat_caller_address(vault_c, user);
    vault.deposit_assets(1000 * SCALE, user);

    // Need moonUSD in the vault for withdrawal (deposit went to SP)
    // In real scenario, SP would return assets. For test, mint to vault
    mint_moonusd_to(moonusd, vault_c, 500 * SCALE);

    // Redeem 500 shares
    start_cheat_caller_address(vault_c, user);
    let assets = vault.redeem(500 * SCALE, user, user);

    assert(assets == 500 * SCALE, 'Should get 500 assets back');
}

// ==========================================================================
// Preview Functions
// ==========================================================================

#[test]
fn test_vault_c_preview_deposit() {
    let (_moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };

    // First deposit: 1:1
    let shares = vault.preview_deposit(1000 * SCALE);
    assert(shares == 1000 * SCALE, 'Preview should show 1:1');
}

#[test]
fn test_vault_c_convert_round_trip() {
    let (moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };
    let user = USER1();

    // Deposit to establish ratio
    mint_moonusd_to(moonusd, user, 1000 * SCALE);
    let erc20 = IERC20Dispatcher { contract_address: moonusd };
    start_cheat_caller_address(moonusd, user);
    erc20.approve(vault_c, 1000 * SCALE);
    start_cheat_caller_address(vault_c, user);
    vault.deposit_assets(1000 * SCALE, user);

    // Round-trip conversion should be consistent
    let shares_for_100 = vault.convert_to_shares(100 * SCALE);
    let assets_back = vault.convert_to_assets(shares_for_100);
    assert(assets_back == 100 * SCALE, 'Round trip should be exact');
}

// ==========================================================================
// Max Limits
// ==========================================================================

#[test]
fn test_vault_c_max_deposit() {
    let (_moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };
    let user = USER1();

    let max = vault.max_deposit(user);
    assert(max > 0, 'Max deposit should be > 0');
}

#[test]
fn test_vault_c_max_redeem_zero_when_no_shares() {
    let (_moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };
    let user = USER1();

    let max = vault.max_redeem(user);
    assert(max == 0, 'Max redeem should be 0');
}

// ==========================================================================
// Price Per Share
// ==========================================================================

#[test]
fn test_vault_c_price_per_share_initial() {
    let (_moonusd, _usdc, _sp, vault_c) = setup();
    let vault = IVaultCDispatcher { contract_address: vault_c };

    let pps = vault.get_price_per_share();
    assert(pps == SCALE, 'PPS should be 1.0 initially');
}
