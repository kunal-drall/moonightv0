// Interest accrual mathematics
// Per-second linear approximation of continuous compounding
// D(t) = D_last * (1 + rate/SECONDS_PER_YEAR * (t - t_last))

use moonight::math::fixed_point::{SCALE, SECONDS_PER_YEAR, BPS_SCALE, mul_fp};

/// Calculate accrued debt using per-second linear approximation
/// debt: current debt in 18-decimal
/// rate_bps: annual interest rate in basis points (e.g., 500 = 5%)
/// dt_seconds: time elapsed since last update in seconds
/// Returns: new debt amount in 18-decimal
pub fn accrue_interest(debt: u256, rate_bps: u256, dt_seconds: u64) -> u256 {
    if dt_seconds == 0 || rate_bps == 0 || debt == 0 {
        return debt;
    }

    // interest = debt * rate_bps / BPS_SCALE / SECONDS_PER_YEAR * dt
    // Rearranged to minimize precision loss:
    // interest = debt * rate_bps * dt / (BPS_SCALE * SECONDS_PER_YEAR)
    let dt: u256 = dt_seconds.into();
    let numerator = debt * rate_bps * dt;
    let denominator = BPS_SCALE * SECONDS_PER_YEAR;
    let interest = numerator / denominator;

    debt + interest
}

/// Calculate the borrow fee (upfront fee at mint time)
/// mint_amount: amount of moonUSD being minted (18-decimal)
/// market_avg_rate_bps: weighted average rate (r_bar) in basis points
/// fee_days: number of days of interest to charge upfront (default: 7)
/// Returns: fee amount in 18-decimal
pub fn calculate_borrow_fee(
    mint_amount: u256, market_avg_rate_bps: u256, fee_days: u256,
) -> u256 {
    if market_avg_rate_bps == 0 {
        return 0;
    }

    // fee = mint_amount * market_avg_rate_bps / BPS_SCALE / 365 * fee_days
    // Rearranged: fee = mint_amount * market_avg_rate_bps * fee_days / (BPS_SCALE * 365)
    let numerator = mint_amount * market_avg_rate_bps * fee_days;
    let denominator = BPS_SCALE * 365;
    numerator / denominator
}

/// Calculate the health factor
/// collateral_value: C in 18-decimal USD
/// ltv_max_bps: maximum LTV in basis points (e.g., 8000 = 80%)
/// debt: current debt in 18-decimal
/// Returns: health factor in 18-decimal (1.0 = SCALE)
pub fn calculate_health_factor(collateral_value: u256, ltv_max_bps: u256, debt: u256) -> u256 {
    if debt == 0 {
        return 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF_u256; // max u256, effectively infinite
    }

    // HF = (C * LTV_max) / D
    // In fixed-point: HF = (collateral_value * ltv_max_bps * SCALE) / (BPS_SCALE * debt)
    let numerator = collateral_value * ltv_max_bps * SCALE;
    let denominator = BPS_SCALE * debt;
    numerator / denominator
}

/// Calculate collateral value in USD
/// amount: collateral amount in native decimals (e.g., 8 for BTC)
/// price: oracle price in 18-decimal
/// collateral_decimals: number of decimals for the collateral token
/// Returns: collateral value in 18-decimal USD
pub fn calculate_collateral_value(
    amount: u256, price: u256, collateral_decimals: u8,
) -> u256 {
    // value = amount * price / 10^collateral_decimals
    let mut divisor: u256 = 1;
    let mut i: u8 = 0;
    while i < collateral_decimals {
        divisor = divisor * 10;
        i += 1;
    };
    amount * price / divisor
}

/// Calculate the weighted average interest rate (r_bar)
/// weighted_rate_sum: sum of (debt_i * rate_i) across all positions
/// total_debt: sum of all position debts
/// Returns: weighted average rate in basis points
pub fn calculate_market_average_rate(weighted_rate_sum: u256, total_debt: u256) -> u256 {
    if total_debt == 0 {
        return 0;
    }
    weighted_rate_sum / total_debt
}

#[cfg(test)]
mod tests {
    use super::{accrue_interest, calculate_borrow_fee, calculate_health_factor, calculate_collateral_value, calculate_market_average_rate};
    use moonight::math::fixed_point::SCALE;

    #[test]
    fn test_accrue_interest_zero_rate() {
        let debt = 1000 * SCALE;
        assert(accrue_interest(debt, 0, 31536000) == debt, 'accrue 0 rate');
    }

    #[test]
    fn test_accrue_interest_zero_time() {
        let debt = 1000 * SCALE;
        assert(accrue_interest(debt, 500, 0) == debt, 'accrue 0 dt');
    }

    #[test]
    fn test_accrue_interest_5pct_1yr() {
        let debt = 1000 * SCALE;
        assert(accrue_interest(debt, 500, 31536000) == 1050 * SCALE, 'accrue 5% 1yr');
    }

    #[test]
    fn test_health_factor_two() {
        let hf = calculate_health_factor(10_000 * SCALE, 8000, 4_000 * SCALE);
        assert(hf == 2 * SCALE, 'HF should be 2.0');
    }

    #[test]
    fn test_health_factor_zero_debt() {
        let hf = calculate_health_factor(10_000 * SCALE, 8000, 0);
        let max_sentinel: u256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
        assert(hf == max_sentinel, 'HF 0 debt = max');
    }

    #[test]
    fn test_collateral_value_1btc() {
        let amount: u256 = 100_000_000;
        let price = 50_000 * SCALE;
        assert(calculate_collateral_value(amount, price, 8) == 50_000 * SCALE, '1btc@50k');
    }

    #[test]
    fn test_borrow_fee_zero_rate() {
        assert(calculate_borrow_fee(1000 * SCALE, 0, 7) == 0, 'fee 0 rate');
    }

    #[test]
    fn test_market_avg_rate_zero_debt() {
        assert(calculate_market_average_rate(500_000, 0) == 0, 'avg 0 debt');
    }

    #[test]
    fn test_market_avg_rate_basic() {
        assert(calculate_market_average_rate(1_700_000, 3_000) == 566, 'avg rate');
    }
}
