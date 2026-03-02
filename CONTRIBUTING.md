# Contributing to Moonight Protocol

Thank you for your interest in contributing to Moonight. This guide covers everything you need to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Security](#security)

---

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive experience for everyone.

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Scarb](https://docs.swmansion.com/scarb/) | 2.9.2 | Cairo build tool |
| [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/) | 0.35.0 | Contract testing |
| [Node.js](https://nodejs.org/) | 20+ | Frontend & backend |
| [pnpm](https://pnpm.io/) | 10+ | Package manager |

### Quick Install

```bash
# Install Scarb and Starknet Foundry
bash scripts/install-tools.sh

# Install Node.js dependencies
pnpm install
```

---

## Development Setup

### 1. Fork and Clone

```bash
git clone https://github.com/<your-username>/moonightv0.git
cd moonightv0
pnpm install
```

### 2. Build Everything

```bash
# Contracts
cd packages/contracts && scarb build

# Frontend
pnpm --filter @moonight/frontend build

# Backend
pnpm --filter @moonight/backend build
```

### 3. Run Locally

```bash
# Frontend dev server (port 3000)
pnpm --filter @moonight/frontend dev

# Landing page dev server (port 3002)
pnpm --filter @moonight/landing dev
```

---

## Making Changes

### Branch Naming

Use descriptive branch names with a prefix:

| Prefix | Use For |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code restructuring |
| `docs/` | Documentation |
| `test/` | Test additions or fixes |
| `chore/` | Build, CI, dependency updates |

Example: `feat/vault-b-leverage-slider`, `fix/oracle-staleness-check`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`

**Scopes**: `contracts`, `frontend`, `backend`, `vault`, `cdp`, `oracle`, `card`, `ci`

Examples:
```
feat(vault): add leverage slider to Vault B deposit flow
fix(oracle): handle TWAP window edge case when fewer than 3 sources
test(cdp): add liquidation test for multi-collateral positions
docs: update README with deployment instructions
```

### GPG Signing

All commits must be GPG-signed. Configure signing:

```bash
# Generate key (if you don't have one)
gpg --full-generate-key

# Configure git
git config --global user.signingkey <YOUR_KEY_ID>
git config --global commit.gpgsign true

# Add public key to GitHub: Settings > SSH and GPG keys > New GPG key
gpg --armor --export <YOUR_KEY_ID>
```

---

## Pull Request Process

### 1. Before Submitting

- [ ] Your code builds without errors (`scarb build`, `pnpm build`)
- [ ] All existing tests pass (`scarb test`, `snforge test`)
- [ ] You've added tests for new functionality
- [ ] Your commits are GPG-signed
- [ ] Your branch is up to date with `main`

### 2. PR Template

When opening a PR, include:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Bullet list of specific changes

## Testing
- How you tested your changes
- Any new tests added

## Breaking Changes
- List any breaking changes (or "None")
```

### 3. Review Process

- All PRs require at least 1 approval
- CI must pass (contracts build, frontend build, backend build, tests, lint)
- Maintainers may request changes — please address feedback promptly
- PRs affecting smart contracts receive extra scrutiny

### 4. After Merge

- Your branch will be automatically deleted
- Changes will be deployed to Sepolia testnet via CI (if contracts changed)

---

## Coding Standards

### Cairo (Smart Contracts)

- Follow the [Cairo Style Guide](https://docs.swmansion.com/scarb/docs/reference/manifest.html)
- Use `scarb fmt` to format code
- All external functions must have input validation
- Use `assert()` with descriptive error messages
- Prefer `StoragePointerReadAccess`/`StoragePointerWriteAccess` for storage
- All state-mutating functions should emit events
- Use OpenZeppelin components (Ownable, Pausable, ReentrancyGuard) where appropriate

```cairo
// Good
#[external(v0)]
fn deposit(ref self: ContractState, amount: u256) {
    assert(!self.paused.read(), 'Contract is paused');
    assert(amount > 0, 'Zero amount');
    let caller = get_caller_address();
    // ... logic
    self.emit(Deposit { user: caller, amount });
}
```

### TypeScript (Frontend & Backend)

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use descriptive variable names
- Handle errors explicitly — no silent catches
- Frontend: use React hooks for contract interactions
- Backend: use typed request/response interfaces

### Testing

- **Contracts**: Write tests in `packages/contracts/tests/` using snforge
- **Math functions**: Add inline `#[cfg(test)]` tests for pure functions
- **Frontend**: Test hooks and complex logic, not UI rendering
- **Backend**: Test services and API routes

---

## Testing

### Running Tests

```bash
# Unit tests (inline, memory-safe)
bash scripts/test-unit.sh

# Integration tests (requires snforge, 16GB+ RAM)
cd packages/contracts && snforge test

# Frontend type check
pnpm --filter @moonight/frontend build

# Backend type check
cd packages/backend && npx tsc --noEmit
```

### Writing Contract Tests

Tests go in `packages/contracts/tests/`. Use the test utilities in `src/test_utils/`:

```cairo
use moonight::test_utils::setup::{deploy_moonusd, deploy_mock_oracle};
use snforge_std::{declare, ContractClassTrait, start_cheat_caller_address};

#[test]
fn test_my_feature() {
    let owner = starknet::contract_address_const::<'owner'>();
    let moonusd_addr = deploy_moonusd(owner);
    // ... test logic
}
```

---

## Security

### Reporting Vulnerabilities

**Do NOT open a public issue for security vulnerabilities.**

Email security reports to: **security@moonight.fun**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge reports within 48 hours and provide a detailed response within 7 days.

### Security Guidelines for Contributors

- Never commit private keys, API keys, or secrets
- Do not disable security checks (`--no-verify`, etc.)
- All external inputs must be validated
- Use checked arithmetic for financial calculations
- Follow the principle of least privilege for access control
- Review the [OWASP Top 10](https://owasp.org/www-project-top-ten/) before writing API endpoints

---

## Areas for Contribution

Looking for something to work on? Here are areas where we welcome contributions:

| Area | Difficulty | Description |
|------|-----------|-------------|
| Documentation | Easy | Improve docs, fix typos, add examples |
| Frontend UI | Medium | New components, mobile responsiveness, animations |
| Test Coverage | Medium | More edge case tests for contracts |
| Gas Optimization | Hard | Optimize Cairo contract gas usage |
| New Collateral Types | Hard | Add support for tBTC, solvBTC |
| Keeper Bot Improvements | Medium | Better liquidation strategies, monitoring |

---

## Questions?

- Open a [Discussion](https://github.com/kunal-drall/moonightv0/discussions) for general questions
- Open an [Issue](https://github.com/kunal-drall/moonightv0/issues) for bugs or feature requests
- Join our [Discord](https://discord.gg/cZa7YpyQ) for real-time chat

Thank you for helping build the future of BTC DeFi on Starknet.
