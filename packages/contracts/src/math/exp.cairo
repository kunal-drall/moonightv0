// Exponential decay approximation for base rate calculation
// Uses Taylor series: e^(-x) ≈ 1 - x + x²/2 - x³/6 + x⁴/24
// All calculations in 18-decimal fixed-point

use moonight::math::fixed_point::{SCALE, mul_fp, div_fp};

/// Calculate exponential decay: value * e^(-lambda * dt)
/// lambda: decay rate in 18-decimal fixed-point (per second)
/// dt: time delta in seconds
/// Returns: decayed value in 18-decimal fixed-point
pub fn exp_decay(value: u256, lambda: u256, dt: u64) -> u256 {
    if dt == 0 {
        return value;
    }

    let x = mul_fp(lambda, dt.into() * SCALE / 3600); // lambda is per hour, convert dt to hours

    // Clamp x to prevent overflow (if x > 10, result is essentially 0)
    if x >= 10 * SCALE {
        return 0;
    }

    let exp_neg_x = exp_neg(x);
    mul_fp(value, exp_neg_x)
}

/// Approximate e^(-x) using Taylor series (4 terms)
/// x is in 18-decimal fixed-point
/// e^(-x) ≈ 1 - x + x²/2 - x³/6 + x⁴/24
fn exp_neg(x: u256) -> u256 {
    if x == 0 {
        return SCALE;
    }

    let x2 = mul_fp(x, x); // x²
    let x3 = mul_fp(x2, x); // x³
    let x4 = mul_fp(x3, x); // x⁴

    let term1 = SCALE; // 1
    let term2 = x; // -x (subtracted below)
    let term3 = x2 / 2; // +x²/2
    let term4 = x3 / 6; // -x³/6
    let term5 = x4 / 24; // +x⁴/24

    // 1 - x + x²/2 - x³/6 + x⁴/24
    // Rearrange to avoid underflow: (1 + x²/2 + x⁴/24) - (x + x³/6)
    let positive = term1 + term3 + term5;
    let negative = term2 + term4;

    if positive > negative {
        positive - negative
    } else {
        0 // Floor at 0 for very large x
    }
}
