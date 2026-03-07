/**
 * Moonight Protocol - Wire Permissions on Sepolia
 *
 * Sets up contract-to-contract permissions after deployment:
 * - MoonUSD: add CDPManager as minter/burner
 * - PositionNFT: set CDPManager as authorized minter/burner
 * - StabilityPool: set CDPManager as authorized caller
 * - RedemptionManager: set CDPManager as authorized caller
 * - PriceOracle: configure asset keys for WBTC
 * - CDPManager: add WBTC collateral type
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... DEPLOYER_ADDRESS=0x... npx tsx scripts/wire-permissions.ts
 */

import { RpcProvider, Account, Contract, CallData, uint256 } from "starknet";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RPC_URL =
  process.env.STARKNET_RPC_URL ||
  "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS!;

if (!PRIVATE_KEY || !DEPLOYER_ADDRESS) {
  console.error("Missing DEPLOYER_PRIVATE_KEY or DEPLOYER_ADDRESS");
  process.exit(1);
}

// Load deployment addresses
const deploymentPath = join(__dirname, "..", "deployments", "sepolia-latest.json");
const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"));

const addresses = {
  moonusd: deployment.contracts.MoonUSD.address,
  positionNft: deployment.contracts.PositionNFT.address,
  priceOracle: deployment.contracts.PriceOracle.address,
  stabilityPool: deployment.contracts.StabilityPool.address,
  redemptionManager: deployment.contracts.RedemptionManager.address,
  protocolConfig: deployment.contracts.ProtocolConfig.address,
  cdpManager: deployment.contracts.CDPManager.address,
};

// Load MockWBTC address
const mockWbtcPath = join(__dirname, "..", "deployments", "mock-wbtc-sepolia.json");
if (!existsSync(mockWbtcPath)) {
  console.error("MockWBTC not deployed. Run deploy-mock-wbtc.ts first.");
  process.exit(1);
}
const mockWbtcDeployment = JSON.parse(readFileSync(mockWbtcPath, "utf-8"));
const MOCK_WBTC_ADDRESS = mockWbtcDeployment.address;

// Pragma Oracle on Sepolia
const PRAGMA_ORACLE_SEPOLIA =
  "0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a";

async function main() {
  console.log("========================================");
  console.log("Moonight Protocol - Wire Permissions");
  console.log("========================================");
  console.log(`Network: Sepolia`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Deployer: ${DEPLOYER_ADDRESS}`);
  console.log("");

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider,
    address: DEPLOYER_ADDRESS,
    signer: PRIVATE_KEY,
  });

  // Build multicall: all permission-setting calls in one transaction
  const calls: any[] = [];

  // 1. MoonUSD: add CDPManager as minter
  console.log("1. MoonUSD → add CDPManager as minter");
  calls.push({
    contractAddress: addresses.moonusd,
    entrypoint: "add_minter",
    calldata: CallData.compile({ minter: addresses.cdpManager }),
  });

  // 2. MoonUSD: add CDPManager as burner
  console.log("2. MoonUSD → add CDPManager as burner");
  calls.push({
    contractAddress: addresses.moonusd,
    entrypoint: "add_burner",
    calldata: CallData.compile({ burner: addresses.cdpManager }),
  });

  // 3. MoonUSD: add StabilityPool as burner (absorb burns moonUSD)
  console.log("3. MoonUSD → add StabilityPool as burner");
  calls.push({
    contractAddress: addresses.moonusd,
    entrypoint: "add_burner",
    calldata: CallData.compile({ burner: addresses.stabilityPool }),
  });

  // 4. MoonUSD: add RedemptionManager as burner
  console.log("4. MoonUSD → add RedemptionManager as burner");
  calls.push({
    contractAddress: addresses.moonusd,
    entrypoint: "add_burner",
    calldata: CallData.compile({ burner: addresses.redemptionManager }),
  });

  // 5. PositionNFT: set CDPManager
  console.log("5. PositionNFT → set CDPManager");
  calls.push({
    contractAddress: addresses.positionNft,
    entrypoint: "set_cdp_manager",
    calldata: CallData.compile({ cdp_manager: addresses.cdpManager }),
  });

  // 6. StabilityPool: set CDPManager
  console.log("6. StabilityPool → set CDPManager");
  calls.push({
    contractAddress: addresses.stabilityPool,
    entrypoint: "set_cdp_manager",
    calldata: CallData.compile({ cdp_manager: addresses.cdpManager }),
  });

  // 7. RedemptionManager: set CDPManager
  console.log("7. RedemptionManager → set CDPManager");
  calls.push({
    contractAddress: addresses.redemptionManager,
    entrypoint: "set_cdp_manager",
    calldata: CallData.compile({ cdp_manager: addresses.cdpManager }),
  });

  // 8. PriceOracle: set Pragma address
  console.log("8. PriceOracle → set Pragma oracle address");
  calls.push({
    contractAddress: addresses.priceOracle,
    entrypoint: "set_pragma_address",
    calldata: CallData.compile({ address: PRAGMA_ORACLE_SEPOLIA }),
  });

  // 9. PriceOracle: set asset key for WBTC → BTC/USD
  console.log("9. PriceOracle → set WBTC asset key to BTC/USD");
  calls.push({
    contractAddress: addresses.priceOracle,
    entrypoint: "set_asset_key",
    calldata: CallData.compile({
      collateral_type: "WBTC",
      pragma_key: "BTC/USD",
    }),
  });

  // 10. PriceOracle: set staleness to 3600s
  console.log("10. PriceOracle → set max staleness 3600s");
  calls.push({
    contractAddress: addresses.priceOracle,
    entrypoint: "set_max_staleness",
    calldata: CallData.compile({ staleness: 3600 }),
  });

  // 11. CDPManager: add WBTC collateral type (80% LTV = 8000 bps, 10% penalty = 1000 bps)
  console.log(`11. CDPManager → add_collateral_type WBTC (${MOCK_WBTC_ADDRESS})`);
  calls.push({
    contractAddress: addresses.cdpManager,
    entrypoint: "add_collateral_type",
    calldata: CallData.compile({
      key: "WBTC",
      token: MOCK_WBTC_ADDRESS,
      ltv_max: uint256.bnToUint256(8000n),
      liq_penalty: uint256.bnToUint256(1000n),
    }),
  });

  // 12. StabilityPool: set WBTC collateral token
  console.log(`12. StabilityPool → set_collateral_token WBTC (${MOCK_WBTC_ADDRESS})`);
  calls.push({
    contractAddress: addresses.stabilityPool,
    entrypoint: "set_collateral_token",
    calldata: CallData.compile({
      key: "WBTC",
      token: MOCK_WBTC_ADDRESS,
    }),
  });

  console.log("");
  console.log(`Executing ${calls.length} calls in multicall...`);

  try {
    const tx = await account.execute(calls);
    console.log(`Transaction hash: ${tx.transaction_hash}`);
    console.log("Waiting for confirmation...");

    await provider.waitForTransaction(tx.transaction_hash);
    console.log("All permissions wired successfully!");
    console.log("");
    console.log("Summary:");
    console.log("  - MoonUSD minter: CDPManager");
    console.log("  - MoonUSD burners: CDPManager, StabilityPool, RedemptionManager");
    console.log("  - PositionNFT cdp_manager: CDPManager");
    console.log("  - StabilityPool cdp_manager: CDPManager");
    console.log("  - RedemptionManager cdp_manager: CDPManager");
    console.log("  - PriceOracle pragma: Sepolia Pragma Oracle");
    console.log("  - PriceOracle WBTC key: BTC/USD");
    console.log("  - PriceOracle staleness: 3600s");
    console.log(`  - CDPManager collateral: WBTC → ${MOCK_WBTC_ADDRESS} (80% LTV, 10% penalty)`);
    console.log(`  - StabilityPool collateral: WBTC → ${MOCK_WBTC_ADDRESS}`);
  } catch (error: any) {
    console.error("Failed to execute multicall:", error.message || error);
    // Try individual calls as fallback
    console.log("\nRetrying individual calls...");
    for (let i = 0; i < calls.length; i++) {
      try {
        console.log(`  Call ${i + 1}/${calls.length}...`);
        const tx = await account.execute([calls[i]]);
        await provider.waitForTransaction(tx.transaction_hash);
        console.log(`  Call ${i + 1} OK (${tx.transaction_hash})`);
      } catch (e: any) {
        console.error(`  Call ${i + 1} FAILED: ${e.message || e}`);
      }
    }
  }
}

main().catch(console.error);
