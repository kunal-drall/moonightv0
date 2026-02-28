#!/bin/bash
set -e

echo "=== Moonight Protocol: Installing Development Tools ==="

# 1. Install Rust (required for Scarb and Starknet Foundry)
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust already installed: $(rustc --version)"
fi

# 2. Install Scarb (Cairo package manager + compiler)
if ! command -v scarb &> /dev/null; then
    echo "Installing Scarb 2.9.2..."
    curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh -s -- -v 2.9.2
else
    echo "Scarb already installed: $(scarb --version)"
fi

# 3. Install Starknet Foundry (snforge + sncast)
if ! command -v snforge &> /dev/null; then
    echo "Installing Starknet Foundry 0.35.0..."
    curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | bash
    snfoundryup -v 0.35.0
else
    echo "Starknet Foundry already installed: $(snforge --version)"
fi

# 4. Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
else
    echo "pnpm already installed: $(pnpm --version)"
fi

# 5. Verify installations
echo ""
echo "=== Verification ==="
echo "Rust:   $(rustc --version 2>/dev/null || echo 'NOT FOUND')"
echo "Scarb:  $(scarb --version 2>/dev/null || echo 'NOT FOUND')"
echo "snforge: $(snforge --version 2>/dev/null || echo 'NOT FOUND')"
echo "sncast:  $(sncast --version 2>/dev/null || echo 'NOT FOUND')"
echo "pnpm:   $(pnpm --version 2>/dev/null || echo 'NOT FOUND')"
echo ""
echo "=== All tools installed successfully ==="
