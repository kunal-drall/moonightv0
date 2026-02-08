// Moonight Protocol - Root Module
// BTC-backed stablecoin protocol on Starknet

// Math utilities
pub mod math {
    pub mod fixed_point;
    pub mod exp;
    pub mod softmax;
}

// Interface definitions
pub mod interfaces {
    pub mod i_moonusd;
    pub mod i_cdp_manager;
    pub mod i_position_nft;
    pub mod i_stability_pool;
    pub mod i_redemption_manager;
    pub mod i_price_oracle;
    pub mod i_protocol_config;
    pub mod i_vault_a;
    pub mod i_vault_c;
    pub mod i_pragma;
    pub mod i_extended_dex;
    pub mod i_ekubo;
}

// Token contracts
pub mod token {
    pub mod moonusd;
}

// CDP engine
pub mod cdp {
    pub mod cdp_manager;
    pub mod position_nft;
    pub mod interest;
    pub mod collateral_config;
}

// Pool contracts
pub mod pool {
    pub mod stability_pool;
    pub mod redemption_manager;
}

// Oracle
pub mod oracle {
    pub mod price_oracle;
}

// Vaults
pub mod vault {
    pub mod vault_a;
    pub mod vault_c;
    pub mod vault_b_stub;
    pub mod vault_d_stub;
}

// Configuration
pub mod config {
    pub mod protocol_config;
}

// Test utilities (only available in tests)
#[cfg(test)]
pub mod test_utils {
    pub mod mock_oracle;
    pub mod mock_erc20;
    pub mod mock_extended;
    pub mod setup;
}
