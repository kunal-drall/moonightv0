use moonight::math::fixed_point::{
    SCALE, BPS_SCALE, mul_fp, div_fp, from_bps, to_bps, min, max, percentage, normalize_price,
};
use moonight::math::exp::exp_decay;
use moonight::cdp::interest;

// ---------------------------------------------------------------------------
// Helper constants
// ---------------------------------------------------------------------------
const HALF_SCALE: u256 = 500_000_000_000_000_000; // 5 * 10^17
const TOLERANCE: u256 = 1_000_000_000; // 10^9 – acceptable rounding error

/// Check whether two u256 values are within `tol` of each other.
fn assert_approx(actual: u256, expected: u256, tol: u256, msg: felt252) {
    let diff = if actual > expected {
        actual - expected
    } else {
        expected - actual
    };
    assert(diff <= tol, msg);
}

// ===========================================================================
//  mul_fp tests
// ===========================================================================

#[test]
fn test_mul_fp_one_times_one() {
    // 1.0 * 1.0 = 1.0
    assert(mul_fp(SCALE, SCALE) == SCALE, 'mul 1*1 should be 1');
}

#[test]
fn test_mul_fp_two_point_five_times_four() {
    // 2.5 * 4.0 = 10.0
    let a = 2_500_000_000_000_000_000; // 2.5 * SCALE
    let b = 4_000_000_000_000_000_000; // 4.0 * SCALE
    let result = mul_fp(a, b);
    assert(result == 10 * SCALE, 'mul 2.5*4 should be 10');
}

#[test]
fn test_mul_fp_zero() {
    // 0 * anything = 0
    assert(mul_fp(0, SCALE) == 0, 'mul 0*1 should be 0');
    assert(mul_fp(SCALE, 0) == 0, 'mul 1*0 should be 0');
    assert(mul_fp(0, 0) == 0, 'mul 0*0 should be 0');
}

#[test]
fn test_mul_fp_large_values() {
    // 1_000_000 * 1_000_000 = 1_000_000_000_000
    let a = 1_000_000 * SCALE;
    let b = 1_000_000 * SCALE;
    let result = mul_fp(a, b);
    assert(result == 1_000_000_000_000 * SCALE, 'mul large values');
}

#[test]
fn test_mul_fp_fractions() {
    // 0.5 * 0.5 = 0.25
    let half = SCALE / 2;
    let result = mul_fp(half, half);
    // (0.5e18 * 0.5e18 + 0.5e18) / 1e18 = (0.25e36 + 0.5e18) / 1e18 = 0.25e18
    assert_approx(result, SCALE / 4, 1, 'mul 0.5*0.5 should be 0.25');
}

// ===========================================================================
//  div_fp tests
// ===========================================================================

#[test]
fn test_div_fp_ten_over_two() {
    // 10 / 2 = 5
    let result = div_fp(10 * SCALE, 2 * SCALE);
    assert(result == 5 * SCALE, 'div 10/2 should be 5');
}

#[test]
fn test_div_fp_one_over_three() {
    // 1 / 3 ≈ 0.333333...
    let result = div_fp(SCALE, 3 * SCALE);
    // Expected: (1e18 * 1e18 + 1.5e18) / (3e18) = 333333333333333334 (rounded)
    let expected: u256 = 333_333_333_333_333_334;
    assert_approx(result, expected, 1, 'div 1/3 approx');
}

#[test]
fn test_div_fp_x_over_one() {
    // x / 1 = x
    let x = 42 * SCALE;
    let result = div_fp(x, SCALE);
    assert(result == x, 'div x/1 should be x');
}

#[test]
#[should_panic(expected: 'Division by zero')]
fn test_div_fp_by_zero() {
    div_fp(SCALE, 0);
}

// ===========================================================================
//  from_bps / to_bps round-trip tests
// ===========================================================================

#[test]
fn test_bps_roundtrip_8000() {
    // 8000 bps = 80%
    let fp = from_bps(8000);
    // 8000 * 1e18 / 10000 = 8e17
    assert(fp == 800_000_000_000_000_000, 'from_bps(8000)');
    let back = to_bps(fp);
    assert(back == 8000, 'to_bps roundtrip 8000');
}

#[test]
fn test_bps_roundtrip_50() {
    // 50 bps = 0.5%
    let fp = from_bps(50);
    // 50 * 1e18 / 10000 = 5e15
    assert(fp == 5_000_000_000_000_000, 'from_bps(50)');
    let back = to_bps(fp);
    assert(back == 50, 'to_bps roundtrip 50');
}

#[test]
fn test_bps_roundtrip_10000() {
    // 10000 bps = 100% = 1.0
    let fp = from_bps(10000);
    assert(fp == SCALE, 'from_bps(10000) should be SCALE');
    let back = to_bps(fp);
    assert(back == 10000, 'to_bps roundtrip 10000');
}

// ===========================================================================
//  normalize_price tests
// ===========================================================================

#[test]
fn test_normalize_price_8_to_18() {
    // A price with 8 decimals (e.g., Chainlink BTC/USD: $50,000 = 50000_00000000)
    let price_8dec: u256 = 50_000_00000000; // 50,000 with 8 decimals
    let normalized = normalize_price(price_8dec, 8);
    // Should multiply by 10^10
    assert(normalized == 50_000 * SCALE, 'normalize 8->18');
}

#[test]
fn test_normalize_price_18_passthrough() {
    // Already 18 decimals — no change
    let price_18dec = 50_000 * SCALE;
    let normalized = normalize_price(price_18dec, 18);
    assert(normalized == price_18dec, 'normalize 18->18 passthrough');
}

#[test]
fn test_normalize_price_20_to_18() {
    // 20 decimals -> 18 decimals — divide by 10^2 = 100
    let price_20dec: u256 = 50_000 * SCALE * 100; // 50,000 in 20-decimal
    let normalized = normalize_price(price_20dec, 20);
    assert(normalized == 50_000 * SCALE, 'normalize 20->18');
}

// ===========================================================================
//  min / max tests
// ===========================================================================

#[test]
fn test_min_basic() {
    assert(min(3, 7) == 3, 'min(3,7)');
    assert(min(7, 3) == 3, 'min(7,3)');
    assert(min(5, 5) == 5, 'min(5,5)');
}

#[test]
fn test_max_basic() {
    assert(max(3, 7) == 7, 'max(3,7)');
    assert(max(7, 3) == 7, 'max(7,3)');
    assert(max(5, 5) == 5, 'max(5,5)');
}

// ===========================================================================
//  percentage tests
// ===========================================================================

#[test]
fn test_percentage_five_percent_of_1000() {
    // 5% of 1000 SCALE = 50 SCALE
    // percentage(1000*SCALE, 500) = (1000e18 * 500 + 5000) / 10000
    //   = (500_000e18 + 5000) / 10000 = 50e18 (5000 is negligible)
    let result = percentage(1000 * SCALE, 500);
    assert_approx(result, 50 * SCALE, 1, 'pct 5% of 1000');
}

#[test]
fn test_percentage_100_percent() {
    // 100% of X = X
    let x = 123 * SCALE;
    let result = percentage(x, 10000);
    assert(result == x, 'pct 100% of x');
}

#[test]
fn test_percentage_zero() {
    // 0% of anything = 0
    assert(percentage(1000 * SCALE, 0) == 0, 'pct 0% should be 0');
}

// ===========================================================================
//  exp_decay tests
// ===========================================================================

#[test]
fn test_exp_decay_zero_dt() {
    // No time elapsed → no decay
    let value = 1000 * SCALE;
    let lambda = SCALE; // 1.0 per hour
    let result = exp_decay(value, lambda, 0);
    assert(result == value, 'exp_decay dt=0 no change');
}

#[test]
fn test_exp_decay_significant() {
    // With lambda=1.0/hour and dt=3600s (1 hour), x = 1.0
    // e^(-1) ≈ 0.367879...
    // Taylor 4-term: 1 - 1 + 0.5 - 1/6 + 1/24 = 0.375
    let value = 1000 * SCALE;
    let lambda = SCALE; // 1.0 per hour
    let result = exp_decay(value, lambda, 3600); // 1 hour

    // Expected with Taylor approx: 1000 * 0.375 = 375
    let expected = 375 * SCALE;
    // Allow 1% tolerance since it is a Taylor approximation
    let tol = 10 * SCALE; // 10 units
    assert_approx(result, expected, tol, 'exp_decay 1hr');
}

#[test]
fn test_exp_decay_very_large_x_returns_zero() {
    // If lambda * dt/3600 >= 10, result should be 0 (clamped)
    let value = 1000 * SCALE;
    let lambda = 10 * SCALE; // 10.0 per hour
    // dt = 3600s → x = 10 * (3600/3600) = 10 → clamped to 0
    let result = exp_decay(value, lambda, 3600);
    assert(result == 0, 'exp_decay large x = 0');
}

// ===========================================================================
//  accrue_interest tests
// ===========================================================================

#[test]
fn test_accrue_interest_zero_rate() {
    // Zero rate → no interest
    let debt = 1000 * SCALE;
    let result = interest::accrue_interest(debt, 0, 31536000);
    assert(result == debt, 'accrue 0 rate no change');
}

#[test]
fn test_accrue_interest_zero_time() {
    // Zero time → no interest
    let debt = 1000 * SCALE;
    let result = interest::accrue_interest(debt, 500, 0);
    assert(result == debt, 'accrue 0 dt no change');
}

#[test]
fn test_accrue_interest_zero_debt() {
    // Zero debt → no interest
    let result = interest::accrue_interest(0, 500, 31536000);
    assert(result == 0, 'accrue 0 debt no change');
}

#[test]
fn test_accrue_interest_500bps_one_year() {
    // 1000 SCALE debt, 500 bps (5%) annual, 1 full year (31536000 seconds)
    // interest = 1000e18 * 500 * 31536000 / (10000 * 31536000) = 1000e18 * 500 / 10000 = 50e18
    // new_debt = 1000e18 + 50e18 = 1050e18
    let debt = 1000 * SCALE;
    let result = interest::accrue_interest(debt, 500, 31536000);
    assert(result == 1050 * SCALE, 'accrue 5% 1yr');
}

// ===========================================================================
//  calculate_borrow_fee tests
// ===========================================================================

#[test]
fn test_borrow_fee_500bps_7days() {
    // mint_amount = 1000 SCALE, market_avg_rate = 500 bps, fee_days = 7
    // fee = 1000e18 * 500 * 7 / (10000 * 365)
    //     = 1000e18 * 3500 / 3_650_000
    //     = 1000e18 * 35/36500
    //     ≈ 0.9589.. * 1e18
    let result = interest::calculate_borrow_fee(1000 * SCALE, 500, 7);
    // 350/365 * 1e18 = 958904109589041095 (truncated)
    // We allow small tolerance because of integer truncation
    let expected: u256 = 958_904_109_589_041_095;
    assert_approx(result, expected, TOLERANCE, 'borrow fee 500/7d');
}

#[test]
fn test_borrow_fee_zero_rate() {
    let result = interest::calculate_borrow_fee(1000 * SCALE, 0, 7);
    assert(result == 0, 'borrow fee 0 rate');
}

// ===========================================================================
//  calculate_health_factor tests
// ===========================================================================

#[test]
fn test_health_factor_two() {
    // Collateral = $10,000, LTV_max = 80% (8000 bps), Debt = $4,000
    // HF = (10000 * 8000 * SCALE) / (10000 * 4000) = 2 * SCALE
    let collateral_value = 10_000 * SCALE;
    let ltv_max_bps: u256 = 8000;
    let debt = 4_000 * SCALE;
    let hf = interest::calculate_health_factor(collateral_value, ltv_max_bps, debt);
    assert(hf == 2 * SCALE, 'HF should be 2.0');
}

#[test]
fn test_health_factor_zero_debt_is_max() {
    // Zero debt → effectively infinite health factor (max u256 sentinel)
    let hf = interest::calculate_health_factor(10_000 * SCALE, 8000, 0);
    let max_sentinel: u256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    assert(hf == max_sentinel, 'HF 0 debt = max');
}

#[test]
fn test_health_factor_liquidatable() {
    // Collateral = $5,000, LTV_max = 80% (8000 bps), Debt = $5,000
    // HF = (5000 * 8000 * SCALE) / (10000 * 5000) = 0.8 * SCALE
    let hf = interest::calculate_health_factor(5_000 * SCALE, 8000, 5_000 * SCALE);
    let expected = 800_000_000_000_000_000; // 0.8 * SCALE
    assert(hf == expected, 'HF 0.8 liquidatable');
}

// ===========================================================================
//  calculate_collateral_value tests
// ===========================================================================

#[test]
fn test_collateral_value_1btc_50k() {
    // 1 BTC (8 decimals) at $50,000 per BTC
    // amount = 1_00000000 (10^8 sats)
    // price  = 50000 * SCALE (18-decimal)
    // value  = 1e8 * 50000e18 / 1e8 = 50000e18 = 50,000 SCALE
    let amount: u256 = 100_000_000; // 1 BTC in 8-decimal
    let price = 50_000 * SCALE;
    let result = interest::calculate_collateral_value(amount, price, 8);
    assert(result == 50_000 * SCALE, 'collateral 1btc@50k');
}

#[test]
fn test_collateral_value_half_btc() {
    // 0.5 BTC at $50,000
    let amount: u256 = 50_000_000; // 0.5 BTC
    let price = 50_000 * SCALE;
    let result = interest::calculate_collateral_value(amount, price, 8);
    assert(result == 25_000 * SCALE, 'collateral 0.5btc@50k');
}

// ===========================================================================
//  calculate_market_average_rate tests
// ===========================================================================

#[test]
fn test_market_average_rate_basic() {
    // Two positions: debt=1000 at rate=500, debt=2000 at rate=600
    // weighted_rate_sum = 1000*500 + 2000*600 = 500000 + 1200000 = 1700000
    // total_debt = 1000 + 2000 = 3000
    // avg = 1700000 / 3000 = 566 bps (truncated)
    let weighted_rate_sum: u256 = 1_700_000;
    let total_debt: u256 = 3_000;
    let result = interest::calculate_market_average_rate(weighted_rate_sum, total_debt);
    assert(result == 566, 'market avg rate');
}

#[test]
fn test_market_average_rate_zero_debt() {
    // Zero total debt → 0
    let result = interest::calculate_market_average_rate(500_000, 0);
    assert(result == 0, 'market avg 0 debt');
}

#[test]
fn test_market_average_rate_single_position() {
    // Single position: debt=1000 at rate=500
    // weighted_rate_sum = 1000*500 = 500000
    // total_debt = 1000
    // avg = 500000 / 1000 = 500
    let result = interest::calculate_market_average_rate(500_000, 1_000);
    assert(result == 500, 'market avg single pos');
}
