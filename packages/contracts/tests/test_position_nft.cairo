use starknet::ContractAddress;
use snforge_std::start_cheat_caller_address;
use moonight::test_utils::setup::{OWNER, USER1, USER2, deploy_position_nft};
use moonight::interfaces::i_position_nft::{IPositionNFTDispatcher, IPositionNFTDispatcherTrait};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn CDP_MANAGER() -> ContractAddress {
    starknet::contract_address_const::<'CDP_MANAGER'>()
}

fn setup_position_nft() -> (ContractAddress, IPositionNFTDispatcher) {
    let owner = OWNER();
    let addr = deploy_position_nft(owner);
    let nft = IPositionNFTDispatcher { contract_address: addr };
    (addr, nft)
}

/// Deploy and wire up with cdp_manager already set.
fn setup_position_nft_with_cdp_manager() -> (ContractAddress, IPositionNFTDispatcher) {
    let owner = OWNER();
    let addr = deploy_position_nft(owner);
    let nft = IPositionNFTDispatcher { contract_address: addr };

    start_cheat_caller_address(addr, owner);
    nft.set_cdp_manager(CDP_MANAGER());

    (addr, nft)
}

// ===========================================================================
//  Tests
// ===========================================================================

#[test]
fn test_nft_initial_state() {
    let (_addr, nft) = setup_position_nft();
    let total = nft.get_total_supply();
    assert(total == 0_u256, 'total supply should be 0');
}

#[test]
fn test_set_cdp_manager() {
    let (addr, nft) = setup_position_nft();
    let owner = OWNER();

    start_cheat_caller_address(addr, owner);
    nft.set_cdp_manager(CDP_MANAGER());
    // If set_cdp_manager did not panic, the call succeeded.
    // We verify indirectly: cdp_manager can now mint.
    start_cheat_caller_address(addr, CDP_MANAGER());
    let token_id = nft.mint(USER1());
    assert(token_id == 1_u256, 'first token id should be 1');
}

#[test]
fn test_mint_by_cdp_manager() {
    let (addr, nft) = setup_position_nft_with_cdp_manager();

    start_cheat_caller_address(addr, CDP_MANAGER());
    let token_id = nft.mint(USER1());

    assert(token_id == 1_u256, 'first token id should be 1');
    assert(nft.get_total_supply() == 1_u256, 'total supply should be 1');
}

#[test]
fn test_mint_increments_id() {
    let (addr, nft) = setup_position_nft_with_cdp_manager();

    start_cheat_caller_address(addr, CDP_MANAGER());
    let id1 = nft.mint(USER1());
    let id2 = nft.mint(USER1());

    assert(id1 == 1_u256, 'first id should be 1');
    assert(id2 == 2_u256, 'second id should be 2');
    assert(nft.get_total_supply() == 2_u256, 'total supply should be 2');
}

#[test]
#[should_panic(expected: 'Only CDPManager can call')]
fn test_mint_unauthorized_fails() {
    let (addr, nft) = setup_position_nft_with_cdp_manager();

    // USER1 is not the cdp_manager, so this should fail
    start_cheat_caller_address(addr, USER1());
    nft.mint(USER1());
}

#[test]
fn test_burn_by_cdp_manager() {
    let (addr, nft) = setup_position_nft_with_cdp_manager();

    start_cheat_caller_address(addr, CDP_MANAGER());
    let token_id = nft.mint(USER1());
    assert(nft.get_total_supply() == 1_u256, 'supply should be 1 after mint');

    nft.burn(token_id);
    assert(nft.get_total_supply() == 0_u256, 'supply should be 0 after burn');
}

#[test]
#[should_panic(expected: 'Only CDPManager can call')]
fn test_burn_unauthorized_fails() {
    let (addr, nft) = setup_position_nft_with_cdp_manager();

    // Mint a token first via cdp_manager
    start_cheat_caller_address(addr, CDP_MANAGER());
    let token_id = nft.mint(USER1());

    // USER1 tries to burn without being cdp_manager
    start_cheat_caller_address(addr, USER1());
    nft.burn(token_id);
}

#[test]
fn test_owner_of_position() {
    let (addr, nft) = setup_position_nft_with_cdp_manager();

    start_cheat_caller_address(addr, CDP_MANAGER());
    let token_id = nft.mint(USER1());

    let owner = nft.owner_of_position(token_id);
    assert(owner == USER1(), 'owner should be USER1');
}
