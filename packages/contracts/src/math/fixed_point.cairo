// Fixed-point arithmetic library for 18-decimal precision
// All values are stored as u256 with 18 decimal places
// e.g., 1.0 = 1_000_000_000_000_000_000 (10^18)

pub const SCALE: u256 = 1_000_000_000_000_000_000; // 10^18
pub const HALF_SCALE: u256 = 500_000_000_000_000_000; // 5 * 10^17
pub const BPS_SCALE: u256 = 10_000; // basis points denominator
pub const SECONDS_PER_YEAR: u256 = 31_536_000; // 365 * 24 * 3600
pub const MAX_SAFE_MUL: u256 = 340_282_366_920_938_463_463; // ~3.4 * 10^38 safe for mul

/// Multiply two fixed-point numbers: (a * b) / SCALE
/// Both a and b are 18-decimal fixed-point values
pub fn mul_fp(a: u256, b: u256) -> u256 {
    let product = a * b;
    (product + HALF_SCALE) / SCALE // rounding
}

/// Divide two fixed-point numbers: (a * SCALE) / b
/// Returns 18-decimal fixed-point result
pub fn div_fp(a: u256, b: u256) -> u256 {
    assert(b > 0, 'Division by zero');
    let scaled = a * SCALE;
    (scaled + b / 2) / b // rounding
}

/// Convert basis points to 18-decimal fixed-point
/// e.g., 8000 bps = 0.8 = 800_000_000_000_000_000
pub fn from_bps(bps: u256) -> u256 {
    bps * SCALE / BPS_SCALE
}

/// Convert 18-decimal fixed-point to basis points
pub fn to_bps(value: u256) -> u256 {
    value * BPS_SCALE / SCALE
}

/// Minimum of two values
pub fn min(a: u256, b: u256) -> u256 {
    if a < b {
        a
    } else {
        b
    }
}

/// Maximum of two values
pub fn max(a: u256, b: u256) -> u256 {
    if a > b {
        a
    } else {
        b
    }
}

/// Calculate percentage: (amount * percentage_bps) / 10000
pub fn percentage(amount: u256, bps: u256) -> u256 {
    (amount * bps + BPS_SCALE / 2) / BPS_SCALE
}

/// Normalize price from arbitrary decimals to 18 decimals
pub fn normalize_price(price: u256, decimals: u32) -> u256 {
    if decimals < 18 {
        let factor = pow10(18 - decimals);
        price * factor
    } else if decimals > 18 {
        let factor = pow10(decimals - 18);
        price / factor
    } else {
        price
    }
}

/// Power of 10
fn pow10(exp: u32) -> u256 {
    let mut result: u256 = 1;
    let mut i: u32 = 0;
    while i < exp {
        result = result * 10;
        i += 1;
    };
    result
}

#[cfg(test)]
mod tests {
    use super::{SCALE, BPS_SCALE, mul_fp, div_fp, from_bps, to_bps, min, max, percentage, normalize_price};

    #[test]
    fn test_mul_fp_one_times_one() {
        assert(mul_fp(SCALE, SCALE) == SCALE, 'mul 1*1 should be 1');
    }

    #[test]
    fn test_mul_fp_two_point_five_times_four() {
        let a = 2_500_000_000_000_000_000;
        let b = 4_000_000_000_000_000_000;
        assert(mul_fp(a, b) == 10 * SCALE, 'mul 2.5*4 should be 10');
    }

    #[test]
    fn test_mul_fp_zero() {
        assert(mul_fp(0, SCALE) == 0, 'mul 0*1 should be 0');
        assert(mul_fp(SCALE, 0) == 0, 'mul 1*0 should be 0');
    }

    #[test]
    fn test_div_fp_ten_over_two() {
        assert(div_fp(10 * SCALE, 2 * SCALE) == 5 * SCALE, 'div 10/2 should be 5');
    }

    #[test]
    fn test_div_fp_x_over_one() {
        let x = 42 * SCALE;
        assert(div_fp(x, SCALE) == x, 'div x/1 should be x');
    }

    #[test]
    #[should_panic(expected: 'Division by zero')]
    fn test_div_fp_by_zero() {
        div_fp(SCALE, 0);
    }

    #[test]
    fn test_bps_roundtrip_8000() {
        let fp = from_bps(8000);
        assert(fp == 800_000_000_000_000_000, 'from_bps(8000)');
        assert(to_bps(fp) == 8000, 'to_bps roundtrip 8000');
    }

    #[test]
    fn test_bps_roundtrip_10000() {
        let fp = from_bps(10000);
        assert(fp == SCALE, 'from_bps(10000)=SCALE');
        assert(to_bps(fp) == 10000, 'to_bps roundtrip 10000');
    }

    #[test]
    fn test_normalize_price_8_to_18() {
        let price_8dec: u256 = 50_000_00000000;
        let normalized = normalize_price(price_8dec, 8);
        assert(normalized == 50_000 * SCALE, 'normalize 8->18');
    }

    #[test]
    fn test_normalize_price_18_passthrough() {
        let price_18dec = 50_000 * SCALE;
        assert(normalize_price(price_18dec, 18) == price_18dec, 'normalize 18->18');
    }

    #[test]
    fn test_min_max() {
        assert(min(3, 7) == 3, 'min(3,7)');
        assert(max(3, 7) == 7, 'max(3,7)');
        assert(min(5, 5) == 5, 'min(5,5)');
    }

    #[test]
    fn test_percentage_five_pct_of_1000() {
        let result = percentage(1000 * SCALE, 500);
        let expected = 50 * SCALE;
        let diff = if result > expected { result - expected } else { expected - result };
        assert(diff <= 1, 'pct 5% of 1000');
    }

    #[test]
    fn test_percentage_zero() {
        assert(percentage(1000 * SCALE, 0) == 0, 'pct 0% should be 0');
    }
}
