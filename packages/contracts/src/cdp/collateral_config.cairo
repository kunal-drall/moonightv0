// Collateral configuration data structures
// Defines per-collateral-type parameters used by CDPManager

use starknet::ContractAddress;

/// Configuration for a single collateral type
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct CollateralParams {
    /// ERC-20 token contract address
    pub token_address: ContractAddress,
    /// Maximum Loan-to-Value ratio in basis points (e.g., 8000 = 80%)
    pub ltv_max_bps: u256,
    /// Liquidation penalty in basis points (e.g., 500 = 5%)
    pub liq_penalty_bps: u256,
    /// Number of decimals for the token (e.g., 8 for BTC)
    pub decimals: u8,
    /// Whether this collateral type is currently enabled
    pub enabled: bool,
}
