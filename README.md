# Moonight Protocol

**Your Bitcoin. Your Bank. Your Yield.**

Moonight is a BTC-backed stablecoin protocol on [Starknet](https://starknet.io). Deposit BTC, mint **moonUSD**, earn yield through automated vault strategies, and spend via a DeFi-native virtual debit card.

[![Contracts CI](https://img.shields.io/badge/contracts-Cairo%202.9.2-blue)](packages/contracts/)
[![Frontend](https://img.shields.io/badge/frontend-Next.js%2014-black)](packages/frontend/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Starknet](https://img.shields.io/badge/network-Starknet%20Sepolia-purple)](https://sepolia.starkscan.co)

---

## Overview

Moonight combines three layers into a unified BTC DeFi stack:

| Layer | Product | Description |
|-------|---------|-------------|
| **Layer 1** | CDP Engine | Deposit BTC collateral, mint moonUSD stablecoin, self-set interest rates |
| **Layer 2** | Yield Vaults | Four automated strategies — delta-neutral, leveraged loop, yield optimizer, covered calls |
| **Layer 3** | DeFi Card | Virtual Visa debit card powered by Rain.xyz, spend moonUSD yield anywhere |

### How It Works

```
BTC Deposit → Mint moonUSD → Deploy to Vaults → Earn Yield → Spend via Card
     ↑                                                              |
     └──────────── Repay debt & withdraw collateral ────────────────┘
```

---

## Architecture

### Smart Contracts (Cairo on Starknet)

| Contract | Purpose | Key Features |
|----------|---------|--------------|
| **CDPManager** | Core lending engine | Open/close positions, mint/repay moonUSD, liquidation, interest accrual |
| **MoonUSD** | ERC-20 stablecoin | Permissioned mint/burn, pausable |
| **PositionNFT** | ERC-721 position tokens | Each CDP is an NFT, transferable |
| **PriceOracle** | Pragma oracle wrapper | TWAP, staleness checks, emergency mode, multi-collateral |
| **StabilityPool** | Liquidation absorption | Liquity-style O(1) accounting with P/S tracking |
| **RedemptionManager** | moonUSD → BTC redemptions | Sorted list by interest rate, fee decay |
| **ProtocolConfig** | Global parameters | Treasury, fee rates, collateral caps |
| **Vault A** | Delta-neutral strategy | Spot BTC + short perp, funding rate harvesting (5-12% APY) |
| **Vault B** | Leveraged BTC accumulation | Recursive CDP loops, up to 3x leverage, auto-deleverage |
| **Vault C** | Yield optimizer (ERC-4626) | vmoonUSD shares, softmax allocation across SP/DEX/lending |
| **Vault D** | Covered call + PT/YT | Sell OTM calls, Pendle-style yield tokenization |

### Math Libraries

- **fixed_point.cairo** — 18-decimal `u256` arithmetic (`mul_fp`, `div_fp`, `from_bps`, `normalize_price`)
- **exp.cairo** — 4-term Taylor series exponential decay for base rate calculations
- **softmax.cairo** — Power-weighted allocation with min/max clamping for vault rebalancing

---

## Vault Strategies

### Vault A — Delta-Neutral Funding Rate
Deposit BTC → open CDP at 60% LTV → swap moonUSD to USDC → open equal long+short on Extended DEX. Captures perpetual funding rate yield with zero directional exposure. Keeper auto-flips when funding rate turns negative.

### Vault B — Leveraged BTC Accumulation
Deposit BTC → mint moonUSD → swap back to BTC → repeat up to 5 loops (~3x effective leverage). Amplified BTC upside with automated deleveraging when health factor approaches danger zone. Adjustable leverage (1x-3x).

### Vault C — Yield Optimizer (ERC-4626)
Deposit moonUSD → receive vmoonUSD vault shares. Protocol allocates across Stability Pool, Ekubo DEX LP, and lending protocols. Softmax-weighted rebalancing with gamma=1.5. Auto-compound with 15% performance fee.

### Vault D — Covered Call + PT/YT
Deposit BTC → receive Principal Tokens (PT) + Yield Tokens (YT). Vault sells out-of-the-money covered calls weekly. If BTC stays below strike: keep BTC + premium. YT tokens are tradeable — separate yield from principal (Pendle-style).

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Smart Contracts | Cairo | 2.9.2 |
| Contract Tooling | Scarb | 2.9.2 |
| Testing | Starknet Foundry (snforge) | 0.35.0 |
| OpenZeppelin | cairo-contracts | v0.20.0 |
| Frontend | Next.js | 14 |
| Wallet Integration | starknet-react | v5 |
| Blockchain SDK | starknet.js | 8.9.2 |
| Backend | Express + TypeScript | Node 20 |
| Oracle | Pragma (on-chain) | Sepolia + Mainnet |
| Database | SQLite via Drizzle ORM | — |
| Monorepo | pnpm + Turborepo | pnpm 10 |

---

## Repository Structure

```
moonightv0/
├── packages/
│   ├── contracts/           # Cairo smart contracts (33 source files)
│   │   ├── src/
│   │   │   ├── interfaces/  # 12 trait definitions
│   │   │   ├── math/        # fixed_point, exp, softmax
│   │   │   ├── token/       # moonusd (ERC-20)
│   │   │   ├── cdp/         # cdp_manager, position_nft, interest, collateral_config
│   │   │   ├── pool/        # stability_pool, redemption_manager
│   │   │   ├── oracle/      # price_oracle (Pragma wrapper)
│   │   │   ├── vault/       # vault_a, vault_b, vault_c, vault_d
│   │   │   └── config/      # protocol_config
│   │   └── tests/           # 7 test files, 88 integration tests
│   ├── frontend/            # App UI (sepolia.moonight.fun / app.moonight.fun)
│   │   ├── src/app/         # Pages: /, /mint, /vaults, /card
│   │   ├── src/components/  # Header, Footer, ConnectWallet, StatsCard
│   │   ├── src/hooks/       # useMoonightContracts
│   │   └── src/providers/   # StarknetProvider (network-aware)
│   ├── landing/             # Landing page (moonight.fun)
│   │   └── src/             # Hero, features, vaults overview, CTA
│   └── backend/             # Keeper bots + Card API (27 source files)
│       ├── src/services/    # keeper/, card/, oracle/, indexer/
│       ├── src/routes/      # REST API endpoints
│       └── src/middleware/   # auth, rate-limiting
├── scripts/
│   ├── deploy-sepolia.ts    # Contract deployment via starknet.js
│   ├── wire-permissions.ts  # Post-deploy permission wiring
│   └── install-tools.sh     # Scarb + snforge installer
├── .github/workflows/       # CI pipeline (7 jobs)
└── docker-compose.yml       # Production deployment
```

---

## Deployed Contracts (Starknet Sepolia)

| Contract | Address |
|----------|---------|
| MoonUSD | [`0x4f939a...e484`](https://sepolia.starkscan.co/contract/0x4f939a71809aee6691bd05bce8c3dec1faf915633a70838a40f4f63ada6e484) |
| PositionNFT | [`0x2750ea...01e1`](https://sepolia.starkscan.co/contract/0x2750ea202b2e14b4bf6d6faeaf58e0818295fa0c77d804b27c1e0c0429d01e1) |
| PriceOracle | [`0x381e47...918a`](https://sepolia.starkscan.co/contract/0x381e474889554290793fde095f133a4f6afdf7e128d0ccb5af7b855967a918a) |
| StabilityPool | [`0x562200...e3d4`](https://sepolia.starkscan.co/contract/0x5622000f5e62e1a09fe586b5d41c2c1c2b6cd0701eae9ed85118658ff67e3d4) |
| RedemptionManager | [`0x78e7d3...9ffb`](https://sepolia.starkscan.co/contract/0x78e7d3ce5f606c66db587a4d38ce808e60973da2a1b61276dfd5bf89f149ffb) |
| ProtocolConfig | [`0x0b49bd...3176`](https://sepolia.starkscan.co/contract/0xb49bd862ff59f5a2c7ef01a23034b346dce65dbc7efa041dfbab895b3a3176) |
| CDPManager | [`0x300a57...a982`](https://sepolia.starkscan.co/contract/0x300a5714cc1bafe5e13297654739cc395703beb15701be71ffb9bf6cdc1a982) |

**Permissions wired**: MoonUSD minter/burner roles, PositionNFT authorization, StabilityPool/RedemptionManager CDP access, PriceOracle configured with Pragma Sepolia feed.

---

## Oracle Integration

Moonight uses [Pragma](https://pragma.build) for on-chain price feeds — no API key required.

```
Pragma Aggregator → Pragma Oracle Contract → PriceOracle.get_price()
                                                    ↓
                                    CDPManager / Vaults / Frontend
```

| Parameter | Value |
|-----------|-------|
| Feed | BTC/USD via `get_data_median` |
| TWAP Window | 15 minutes |
| Max Staleness | 3600 seconds |
| Grace Period | 6 hours (cached price) |
| Emergency Mode | Blocks minting, allows withdrawals |
| Sepolia Address | `0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a` |
| Mainnet Address | `0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b` |

---

## DeFi Card (Rain.xyz)

Moonight integrates with [Rain.xyz](https://rain.xyz) for virtual Visa debit cards.

**Debit Card** (Live on Sepolia):
- Complete KYC via Rain.xyz
- Fund card with USDC (from wallet or Vault C yield)
- Spend anywhere Visa is accepted
- Auto top-up: automatically refill from Vault C when balance drops below threshold

**Credit Card** (Coming Soon):
- Borrow against DeFi positions
- Auto-repay from vault yield
- Available after mainnet launch with sufficient TVL

---

## Multi-Site Architecture

| Domain | Package | Network | Badge |
|--------|---------|---------|-------|
| `moonight.fun` | `packages/landing/` | — | — |
| `sepolia.moonight.fun` | `packages/frontend/` | Sepolia | Testnet |
| `app.moonight.fun` | `packages/frontend/` | Mainnet | Beta |

The same frontend codebase serves both networks. The `NEXT_PUBLIC_STARKNET_NETWORK` env var controls chain selection, badge display, and contract addresses.

---

## Getting Started

### Prerequisites

- [Scarb 2.9.2](https://docs.swmansion.com/scarb/) — Cairo build tool
- [Starknet Foundry 0.35.0](https://foundry-rs.github.io/starknet-foundry/) — Testing framework
- Node.js 20+ and pnpm 10+

```bash
# Install Scarb and Starknet Foundry
bash scripts/install-tools.sh
```

### Build

```bash
# Install dependencies
pnpm install

# Build contracts (requires ~4GB RAM)
cd packages/contracts && scarb build

# Build frontend
pnpm --filter @moonight/frontend build

# Build landing page
pnpm --filter @moonight/landing build

# Build backend
pnpm --filter @moonight/backend build
```

### Test

```bash
# Unit tests (inline, runs locally)
bash scripts/test-unit.sh

# Integration tests (requires snforge, 16GB+ RAM — use CI)
cd packages/contracts && snforge test

# Type-check backend
cd packages/backend && npx tsc --noEmit
```

### Deploy Contracts

```bash
# Deploy to Starknet Sepolia
DEPLOYER_PRIVATE_KEY=0x... \
DEPLOYER_ADDRESS=0x... \
npx tsx scripts/deploy-sepolia.ts

# Wire permissions (post-deployment)
DEPLOYER_PRIVATE_KEY=0x... \
DEPLOYER_ADDRESS=0x... \
npx tsx scripts/wire-permissions.ts
```

### Run Locally

```bash
# Frontend (dev server on port 3000)
pnpm --filter @moonight/frontend dev

# Landing page (dev server on port 3002)
pnpm --filter @moonight/landing dev

# Backend (port 3001)
pnpm --filter @moonight/backend dev
```

---

## Testing

| Layer | Framework | Tests | Status |
|-------|-----------|-------|--------|
| Math (inline) | `scarb test` | 22 | Passing |
| Contract integration | `snforge test` | 88 | CI only (memory) |
| Frontend | `next build` | 5 pages | Passing |
| Backend | `tsc --noEmit` | Type check | Passing |

### Integration Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `test_cdp_lifecycle` | 10 | Open, close, deposit, withdraw, mint, repay, liquidation |
| `test_moonusd` | 10 | Constructor, minter/burner auth, pause, events |
| `test_position_nft` | 8 | Mint, burn, supply tracking, auth |
| `test_fixed_point` | 37 | Arithmetic, edge cases, overflow, normalization |
| `test_stability_pool` | 6 | Deposit, withdraw, absorption, compounding |
| `test_oracle` | 6 | Price fetch, TWAP, staleness, emergency mode |
| `test_vault_c` | 11 | ERC-4626 compliance, deposit/withdraw, shares |

---

## Access Control

```
moonusd.mint()                → CDPManager only
moonusd.burn()                → CDPManager, StabilityPool, RedemptionManager
position_nft.mint/burn()      → CDPManager only
cdp_manager.liquidate()       → Anyone (permissionless)
stability_pool.absorb()       → CDPManager only
stability_pool.deposit()      → Anyone
redemption_manager.redeem()   → Anyone
vault_a.trigger_flip()        → Keeper only
vault_b.check_and_deleverage()→ Keeper only
vault_c.compound()            → Keeper or Owner
vault_d.start/settle_epoch()  → Keeper only
protocol_config.*             → Owner only
```

---

## CI/CD

GitHub Actions runs on every push and PR:

| Job | What It Does |
|-----|--------------|
| `contracts-build` | `scarb build` — compile all Cairo contracts |
| `contracts-test` | `snforge test` — run 88 integration tests |
| `contracts-format` | `scarb fmt --check` — formatting |
| `frontend-build` | Lint + build Next.js app |
| `landing-build` | Build landing page |
| `backend-build` | TypeScript compile + type check |
| `unit-tests` | Run 22 inline unit tests |

### Deployment

- **Landing** → Vercel (`moonight.fun`)
- **Frontend** → Vercel (`sepolia.moonight.fun` / `app.moonight.fun`)
- **Backend** → Docker (`docker-compose.yml`)
- **Contracts** → `scripts/deploy-sepolia.ts` (manual)

---

## Roadmap

- [x] **Phase 1** — Foundation: math libraries, tokens, mock utilities
- [x] **Phase 2** — CDP Core: CDPManager, PriceOracle, StabilityPool, RedemptionManager
- [x] **Phase 3** — Vaults: A (delta-neutral), B (leveraged loop), C (yield optimizer), D (covered call)
- [x] **Phase 4** — Frontend: 4-page app (Dashboard, Mint, Vaults, Card)
- [x] **Phase 5** — Backend: keeper bots, Rain.xyz card, oracle monitor
- [x] **Phase 6** — Testnet: deploy to Sepolia, wire permissions, CI/CD
- [ ] **Phase 7** — Testing: $100K-$500K simulated TVL on Sepolia
- [ ] **Phase 8** — Audit: external security review
- [ ] **Phase 9** — Mainnet Beta: conservative caps, monitoring, gradual rollout

---

## Security

- All admin functions gated by `OwnableComponent`
- `ReentrancyGuardComponent` on state-mutating functions
- `PausableComponent` on all user-facing contracts
- Input validation on every external function
- Checked arithmetic in all fixed-point math (overflow bounds assertions)
- Oracle staleness + emergency mode protections

### Mainnet Readiness Checklist

- [ ] External audit (CertiK / Trail of Bits / OtterSec)
- [ ] Upgradeable proxy pattern on all contracts
- [ ] Multi-sig admin wallet (not EOA)
- [ ] 48-hour timelock on config changes
- [ ] Keeper bots deployed with monitoring
- [ ] Prometheus metrics + alerting (PagerDuty/Discord)
- [ ] Bug bounty program (Immunefi)
- [ ] Conservative initial TVL caps

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables. Key ones:

```bash
# Network
STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo

# Contract addresses (populated after deployment)
NEXT_PUBLIC_CDP_MANAGER=0x...
NEXT_PUBLIC_MOONUSD=0x...
NEXT_PUBLIC_STARKNET_NETWORK=sepolia  # or mainnet

# Oracle (no API key needed — on-chain reads)
PRAGMA_ADDRESS=0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a

# Rain.xyz Card
RAIN_API_KEY=rain_sk_...
RAIN_BASE_URL=https://sandbox.rain.xyz/v1
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -S -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

All commits must be GPG-signed. CI must pass before merge.

---

## License

[MIT](LICENSE)

---

<p align="center">
  <strong>Built on Starknet</strong><br>
  <a href="https://moonight.fun">moonight.fun</a> · <a href="https://sepolia.moonight.fun">Sepolia App</a> · <a href="https://docs.moonight.fun">Docs</a>
</p>
