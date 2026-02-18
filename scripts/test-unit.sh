#!/usr/bin/env bash
# Run unit tests for Moonight Protocol math & interest modules.
# Uses a minimal Scarb.toml to work in memory-constrained environments (<8GB).
# For full integration tests (snforge), use CI with 16GB+ RAM.

set -euo pipefail
cd "$(dirname "$0")/../packages/contracts"

# Backup configs
cp Scarb.toml Scarb.toml.bak
cp src/lib.cairo src/lib.cairo.bak

# Temporarily hide integration tests (they require snforge_std)
if [ -d tests ]; then
    mv tests tests.bak
fi

cat > Scarb.toml <<'EOF'
[package]
name = "moonight"
version = "0.1.0"
edition = "2024_07"
cairo-version = "2.9.2"

[dependencies]
starknet = "2.9.2"

[dev-dependencies]
cairo_test = "2.9.2"
EOF

cat > src/lib.cairo <<'EOF'
pub mod math {
    pub mod fixed_point;
    pub mod exp;
    pub mod softmax;
}
pub mod cdp {
    pub mod interest;
    pub mod collateral_config;
}
EOF

# Clean cached artifacts for minimal build
scarb clean 2>/dev/null || true

# Run tests
echo "Running Moonight unit tests..."
scarb test 2>&1
EXIT_CODE=$?

# Restore original configs
cp Scarb.toml.bak Scarb.toml
cp src/lib.cairo.bak src/lib.cairo
rm -f Scarb.toml.bak src/lib.cairo.bak
if [ -d tests.bak ]; then
    mv tests.bak tests
fi

# Clean again so next build uses full config
scarb clean 2>/dev/null || true

exit $EXIT_CODE
