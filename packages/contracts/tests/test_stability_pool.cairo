use starknet::ContractAddress;
use snforge_std::start_cheat_caller_address;
use moonight::test_utils::setup::{
    OWNER, USER1, USER2, TREASURY,
    deploy_full_protocol, deploy_moonusd, deploy_stability_pool,
    IStabilityPoolAdminDispatcher, IStabilityPoolAdminDispatcherTrait,
};
use moonight::interfaces::i_moonusd::{IMoonUSDDispatcher, IMoonUSDDispatcherTrait};
use moonight::interfaces::i_stability_pool::{IStabilityPoolDispatcher, IStabilityPoolDispatcherTrait};
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

const SCALE: u256 = 1_000_000_000_000_000_000;

/// Deploy a standalone StabilityPool with moonUSD for isolated tests.
fn setup_standalone_sp() -> (ContractAddress, ContractAddress, IStabilityPoolDispatcher, IMoonUSDDispatcher) {
    let owner = OWNER();
    let moonusd_addr = deploy_moonusd(owner);
    let sp_addr = deploy_stability_pool(owner, moonusd_addr);

    let sp = IStabilityPoolDispatcher { contract_address: sp_addr };
    let moonusd = IMoonUSDDispatcher { contract_address: moonusd_addr };

    // Add SP as burner for moonUSD (needed for absorb_liquidation)
    start_cheat_caller_address(moonusd_addr, owner);
    moonusd.add_burner(sp_addr);

    (moonusd_addr, sp_addr, sp, moonusd)
}

/// Mint moonUSD to a user for testing deposits.
fn mint_to_user(moonusd_addr: ContractAddress, moonusd: IMoonUSDDispatcher, user: ContractAddress, amount: u256) {
    let owner = OWNER();
    // Temporarily add owner as minter
    start_cheat_caller_address(moonusd_addr, owner);
    moonusd.add_minter(owner);
    moonusd.mint(user, amount);
}

// ==========================================================================
// Deposit / Withdraw
// ==========================================================================

#[test]
fn test_sp_deposit() {
    let (moonusd_addr, sp_addr, sp, moonusd) = setup_standalone_sp();
    let user = USER1();

    // Mint 1000 moonUSD to user
    mint_to_user(moonusd_addr, moonusd, user, 1000 * SCALE);

    // User approves SP and deposits
    let erc20 = IERC20Dispatcher { contract_address: moonusd_addr };
    start_cheat_caller_address(moonusd_addr, user);
    erc20.approve(sp_addr, 1000 * SCALE);

    start_cheat_caller_address(sp_addr, user);
    sp.deposit(1000 * SCALE);

    // Check balance
    let balance = sp.get_depositor_balance(user);
    assert(balance == 1000 * SCALE, 'SP balance should be 1000');

    let total = sp.get_total_deposits();
    assert(total == 1000 * SCALE, 'Total deposits should be 1000');
}

#[test]
fn test_sp_withdraw() {
    let (moonusd_addr, sp_addr, sp, moonusd) = setup_standalone_sp();
    let user = USER1();

    mint_to_user(moonusd_addr, moonusd, user, 1000 * SCALE);

    let erc20 = IERC20Dispatcher { contract_address: moonusd_addr };
    start_cheat_caller_address(moonusd_addr, user);
    erc20.approve(sp_addr, 1000 * SCALE);

    start_cheat_caller_address(sp_addr, user);
    sp.deposit(1000 * SCALE);

    // Withdraw 400
    sp.withdraw(400 * SCALE);

    let balance = sp.get_depositor_balance(user);
    assert(balance == 600 * SCALE, 'SP balance should be 600');

    let total = sp.get_total_deposits();
    assert(total == 600 * SCALE, 'Total deposits should be 600');
}

#[test]
fn test_sp_multiple_depositors() {
    let (moonusd_addr, sp_addr, sp, moonusd) = setup_standalone_sp();
    let user1 = USER1();
    let user2 = USER2();

    // Mint to both users
    mint_to_user(moonusd_addr, moonusd, user1, 500 * SCALE);
    mint_to_user(moonusd_addr, moonusd, user2, 300 * SCALE);

    let erc20 = IERC20Dispatcher { contract_address: moonusd_addr };

    // User1 deposits
    start_cheat_caller_address(moonusd_addr, user1);
    erc20.approve(sp_addr, 500 * SCALE);
    start_cheat_caller_address(sp_addr, user1);
    sp.deposit(500 * SCALE);

    // User2 deposits
    start_cheat_caller_address(moonusd_addr, user2);
    erc20.approve(sp_addr, 300 * SCALE);
    start_cheat_caller_address(sp_addr, user2);
    sp.deposit(300 * SCALE);

    assert(sp.get_depositor_balance(user1) == 500 * SCALE, 'User1 balance mismatch');
    assert(sp.get_depositor_balance(user2) == 300 * SCALE, 'User2 balance mismatch');
    assert(sp.get_total_deposits() == 800 * SCALE, 'Total should be 800');
}

#[test]
#[should_panic]
fn test_sp_withdraw_more_than_deposited() {
    let (moonusd_addr, sp_addr, sp, moonusd) = setup_standalone_sp();
    let user = USER1();

    mint_to_user(moonusd_addr, moonusd, user, 500 * SCALE);

    let erc20 = IERC20Dispatcher { contract_address: moonusd_addr };
    start_cheat_caller_address(moonusd_addr, user);
    erc20.approve(sp_addr, 500 * SCALE);

    start_cheat_caller_address(sp_addr, user);
    sp.deposit(500 * SCALE);

    // Try to withdraw more than deposited — should panic
    sp.withdraw(600 * SCALE);
}

// ==========================================================================
// Interest Distribution
// ==========================================================================

#[test]
fn test_sp_interest_distribution() {
    let (moonusd_addr, sp_addr, sp, moonusd) = setup_standalone_sp();
    let owner = OWNER();
    let user = USER1();

    // User deposits 1000
    mint_to_user(moonusd_addr, moonusd, user, 1000 * SCALE);
    let erc20 = IERC20Dispatcher { contract_address: moonusd_addr };
    start_cheat_caller_address(moonusd_addr, user);
    erc20.approve(sp_addr, 1000 * SCALE);
    start_cheat_caller_address(sp_addr, user);
    sp.deposit(1000 * SCALE);

    // Distribute 100 moonUSD as interest (would normally come from CDPManager)
    mint_to_user(moonusd_addr, moonusd, sp_addr, 100 * SCALE);

    // CDPManager (or authorized caller) distributes
    start_cheat_caller_address(sp_addr, owner);
    sp.distribute_interest(100 * SCALE);

    // User claims interest
    start_cheat_caller_address(sp_addr, user);
    sp.claim_interest_yield();
}

// ==========================================================================
// Compounded Deposit
// ==========================================================================

#[test]
fn test_sp_compounded_deposit() {
    let (moonusd_addr, sp_addr, sp, moonusd) = setup_standalone_sp();
    let user = USER1();

    mint_to_user(moonusd_addr, moonusd, user, 1000 * SCALE);
    let erc20 = IERC20Dispatcher { contract_address: moonusd_addr };
    start_cheat_caller_address(moonusd_addr, user);
    erc20.approve(sp_addr, 1000 * SCALE);
    start_cheat_caller_address(sp_addr, user);
    sp.deposit(1000 * SCALE);

    // Compounded deposit should match deposit if no liquidations
    let compounded = sp.get_compounded_deposit(user);
    assert(compounded == 1000 * SCALE, 'Compounded should equal deposit');
}
