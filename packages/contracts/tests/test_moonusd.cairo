use starknet::ContractAddress;
use snforge_std::start_cheat_caller_address;
use moonight::test_utils::setup::{OWNER, USER1, deploy_moonusd};
use moonight::interfaces::i_moonusd::{IMoonUSDDispatcher, IMoonUSDDispatcherTrait};
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup_moonusd() -> (ContractAddress, IMoonUSDDispatcher, IERC20Dispatcher) {
    let owner = OWNER();
    let addr = deploy_moonusd(owner);
    let moonusd = IMoonUSDDispatcher { contract_address: addr };
    let erc20 = IERC20Dispatcher { contract_address: addr };
    (addr, moonusd, erc20)
}

// ===========================================================================
//  Tests
// ===========================================================================

#[test]
fn test_moonusd_name_symbol() {
    let (_addr, _moonusd, erc20) = setup_moonusd();
    let name = erc20.name();
    let symbol = erc20.symbol();
    assert(name == "moonUSD", 'name should be moonUSD');
    assert(symbol == "mUSD", 'symbol should be mUSD');
}

#[test]
fn test_add_minter() {
    let (addr, moonusd, _erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    start_cheat_caller_address(addr, owner);
    moonusd.add_minter(user1);

    assert(moonusd.is_minter(user1) == true, 'USER1 should be minter');
}

#[test]
fn test_add_burner() {
    let (addr, moonusd, _erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    start_cheat_caller_address(addr, owner);
    moonusd.add_burner(user1);

    assert(moonusd.is_burner(user1) == true, 'USER1 should be burner');
}

#[test]
fn test_mint_by_authorized_minter() {
    let (addr, moonusd, erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    // Owner adds USER1 as minter
    start_cheat_caller_address(addr, owner);
    moonusd.add_minter(user1);

    // USER1 mints 1000 tokens to themselves
    start_cheat_caller_address(addr, user1);
    moonusd.mint(user1, 1000_u256);

    let balance = erc20.balance_of(user1);
    assert(balance == 1000_u256, 'balance should be 1000');
}

#[test]
#[should_panic(expected: 'Caller is not a minter')]
fn test_mint_by_unauthorized_fails() {
    let (addr, moonusd, _erc20) = setup_moonusd();
    let user1 = USER1();

    // USER1 tries to mint without being authorized
    start_cheat_caller_address(addr, user1);
    moonusd.mint(user1, 1000_u256);
}

#[test]
fn test_burn_by_authorized_burner() {
    let (addr, moonusd, erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    // Owner adds USER1 as both minter and burner
    start_cheat_caller_address(addr, owner);
    moonusd.add_minter(user1);
    moonusd.add_burner(user1);

    // USER1 mints 1000 tokens
    start_cheat_caller_address(addr, user1);
    moonusd.mint(user1, 1000_u256);

    // USER1 burns 400 tokens
    moonusd.burn(user1, 400_u256);

    let balance = erc20.balance_of(user1);
    assert(balance == 600_u256, 'balance should be 600');
}

#[test]
#[should_panic(expected: 'Caller is not a burner')]
fn test_burn_by_unauthorized_fails() {
    let (addr, moonusd, _erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    // Owner adds USER1 as minter so we can mint tokens first
    start_cheat_caller_address(addr, owner);
    moonusd.add_minter(user1);

    // USER1 mints 1000 tokens
    start_cheat_caller_address(addr, user1);
    moonusd.mint(user1, 1000_u256);

    // USER1 tries to burn without being a burner
    moonusd.burn(user1, 400_u256);
}

#[test]
#[should_panic(expected: 'Contract is paused')]
fn test_pause_prevents_minting() {
    let (addr, moonusd, _erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    // Owner adds USER1 as minter, then pauses contract
    start_cheat_caller_address(addr, owner);
    moonusd.add_minter(user1);
    moonusd.pause();

    // USER1 tries to mint while paused
    start_cheat_caller_address(addr, user1);
    moonusd.mint(user1, 1000_u256);
}

#[test]
fn test_unpause_allows_minting() {
    let (addr, moonusd, erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    // Owner adds USER1 as minter, pauses, then unpauses
    start_cheat_caller_address(addr, owner);
    moonusd.add_minter(user1);
    moonusd.pause();
    moonusd.unpause();

    // USER1 mints after unpause
    start_cheat_caller_address(addr, user1);
    moonusd.mint(user1, 1000_u256);

    let balance = erc20.balance_of(user1);
    assert(balance == 1000_u256, 'balance should be 1000');
}

#[test]
#[should_panic(expected: 'Caller is not a minter')]
fn test_remove_minter() {
    let (addr, moonusd, _erc20) = setup_moonusd();
    let owner = OWNER();
    let user1 = USER1();

    // Owner adds then removes USER1 as minter
    start_cheat_caller_address(addr, owner);
    moonusd.add_minter(user1);
    assert(moonusd.is_minter(user1) == true, 'should be minter');

    moonusd.remove_minter(user1);
    assert(moonusd.is_minter(user1) == false, 'should not be minter');

    // USER1 tries to mint after being removed
    start_cheat_caller_address(addr, user1);
    moonusd.mint(user1, 1000_u256);
}
