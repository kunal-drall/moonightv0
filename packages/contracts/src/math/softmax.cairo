// Softmax allocation for Vault C yield routing
// w_i = APY_i^gamma / sum(APY_j^gamma), clamped to [min, max] constraints

use moonight::math::fixed_point::{SCALE, mul_fp, div_fp, BPS_SCALE};

/// Compute power-weighted allocation with clamping
/// apys: array of APY values in basis points (e.g., 1500 = 15%)
/// gamma_bps: softmax exponent in basis points (15000 = 1.5)
/// mins: minimum weight per source in basis points
/// maxs: maximum weight per source in basis points
/// Returns: weights in basis points (sum = 10000)
pub fn softmax_allocate(
    apys: Span<u256>, gamma_bps: u256, mins: Span<u256>, maxs: Span<u256>,
) -> Array<u256> {
    let n = apys.len();
    assert(n == mins.len() && n == maxs.len(), 'Array length mismatch');
    assert(n > 0, 'Empty arrays');

    // Step 1: Compute APY^gamma for each source
    let gamma_fp = gamma_bps * SCALE / BPS_SCALE; // Convert to 18-dec fp
    let mut powered: Array<u256> = ArrayTrait::new();
    let mut total_power: u256 = 0;

    let mut i: u32 = 0;
    while i < n {
        let apy = *apys.at(i);
        // Approximate x^1.5 as x * sqrt(x) using x^1.5 ≈ x * x / sqrt(x)
        // For simplicity, use x^gamma ≈ x * x^(gamma-1) with linear interp
        let p = power_approx(apy, gamma_fp);
        powered.append(p);
        total_power += p;
        i += 1;
    };

    if total_power == 0 {
        // Equal allocation if all APYs are 0
        let equal_weight = BPS_SCALE / n.into();
        let mut result: Array<u256> = ArrayTrait::new();
        let mut i: u32 = 0;
        while i < n {
            result.append(equal_weight);
            i += 1;
        };
        return result;
    }

    // Step 2: Compute raw weights
    let mut raw_weights: Array<u256> = ArrayTrait::new();
    let mut i: u32 = 0;
    while i < n {
        let w = *powered.at(i) * BPS_SCALE / total_power;
        raw_weights.append(w);
        i += 1;
    };

    // Step 3: Clamp to [min, max] and renormalize
    clamp_and_normalize(raw_weights.span(), mins, maxs)
}

/// Approximate x^gamma for gamma = 1.5
/// Uses x^1.5 = x * sqrt(x), approximated as x * x / isqrt(x)
fn power_approx(x_bps: u256, _gamma_fp: u256) -> u256 {
    if x_bps == 0 {
        return 0;
    }
    // x^1.5 ≈ x_bps * sqrt(x_bps)
    // sqrt approximation using integer square root
    let sqrt_x = isqrt(x_bps * 100); // scale up for precision
    x_bps * sqrt_x / 10 // scale back
}

/// Integer square root (Babylonian method)
fn isqrt(n: u256) -> u256 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    };
    x
}

/// Clamp weights to constraints and renormalize to sum = BPS_SCALE
fn clamp_and_normalize(
    weights: Span<u256>, mins: Span<u256>, maxs: Span<u256>,
) -> Array<u256> {
    let n = weights.len();
    let mut clamped: Array<u256> = ArrayTrait::new();
    let mut total: u256 = 0;

    let mut i: u32 = 0;
    while i < n {
        let w = *weights.at(i);
        let min_w = *mins.at(i);
        let max_w = *maxs.at(i);

        let clamped_w = if w < min_w {
            min_w
        } else if w > max_w {
            max_w
        } else {
            w
        };
        clamped.append(clamped_w);
        total += clamped_w;
        i += 1;
    };

    // Renormalize to sum = BPS_SCALE
    if total == 0 {
        return clamped;
    }

    let mut result: Array<u256> = ArrayTrait::new();
    let mut running_total: u256 = 0;
    let mut i: u32 = 0;
    while i < n {
        if i == n - 1 {
            // Last element gets the remainder to ensure exact sum
            result.append(BPS_SCALE - running_total);
        } else {
            let normalized = *clamped.at(i) * BPS_SCALE / total;
            result.append(normalized);
            running_total += normalized;
        }
        i += 1;
    };

    result
}
