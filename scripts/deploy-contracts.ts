/**
 * Moonight Protocol - Contract Deployment Script
 *
 * Usage:
 *   STARKNET_ACCOUNT=<path> STARKNET_KEYSTORE=<path> tsx scripts/deploy-contracts.ts [--network sepolia|mainnet]
 *
 * Environment:
 *   STARKNET_ACCOUNT  - Path to account JSON file
 *   STARKNET_KEYSTORE - Path to keystore file
 *   STARKNET_RPC_URL  - Custom RPC URL (optional)
 *
 * Prerequisites:
 *   - scarb build (contracts compiled to target/dev/)
 *   - sncast account configured
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CONTRACTS_DIR = join(__dirname, "..", "packages", "contracts");
const TARGET_DIR = join(CONTRACTS_DIR, "target", "dev");
const DEPLOY_DIR = join(__dirname, "..", "deployments");

interface DeployedContract {
  name: string;
  classHash: string;
  address: string;
  txHash: string;
}

interface Deployment {
  network: string;
  timestamp: string;
  contracts: Record<string, DeployedContract>;
}

// Contract deployment order (respects dependencies)
const DEPLOY_ORDER = [
  "MoonUSD",
  "PositionNFT",
  "MockERC20", // For testnet WBTC
  "PriceOracle",
  "StabilityPool",
  "RedemptionManager",
  "ProtocolConfig",
  "CDPManager",
];

function getNetwork(): string {
  const args = process.argv.slice(2);
  const networkIdx = args.indexOf("--network");
  if (networkIdx !== -1 && args[networkIdx + 1]) {
    return args[networkIdx + 1];
  }
  return "sepolia";
}

function sncast(cmd: string): string {
  const network = getNetwork();
  const rpcUrl =
    process.env.STARKNET_RPC_URL ||
    (network === "mainnet"
      ? "https://starknet-mainnet.public.blastapi.io"
      : "https://starknet-sepolia.public.blastapi.io/rpc/v0_7");

  const fullCmd = `sncast --url ${rpcUrl} ${cmd}`;
  console.log(`  $ ${fullCmd}`);

  try {
    const output = execSync(fullCmd, {
      cwd: CONTRACTS_DIR,
      encoding: "utf-8",
      timeout: 120_000,
    });
    return output.trim();
  } catch (e: unknown) {
    const error = e as { stderr?: string; stdout?: string };
    console.error(`Command failed: ${error.stderr || error.stdout || e}`);
    throw e;
  }
}

function declareContract(contractName: string): string {
  console.log(`\nDeclaring ${contractName}...`);
  const sierraPath = join(
    TARGET_DIR,
    `moonight_${contractName}.contract_class.json`
  );
  const casmPath = join(
    TARGET_DIR,
    `moonight_${contractName}.compiled_contract_class.json`
  );

  if (!existsSync(sierraPath)) {
    throw new Error(
      `Sierra file not found: ${sierraPath}. Run 'scarb build' first.`
    );
  }

  const output = sncast(
    `declare --contract-name ${contractName} --sierra-path ${sierraPath} --casm-path ${casmPath}`
  );

  // Parse class hash from output
  const classHashMatch = output.match(
    /class_hash:\s*(0x[0-9a-fA-F]+)/
  );
  if (!classHashMatch) {
    // Might already be declared
    if (output.includes("already declared")) {
      console.log(`  Already declared, extracting class hash...`);
      const existingMatch = output.match(/(0x[0-9a-fA-F]{50,})/);
      if (existingMatch) return existingMatch[1];
    }
    throw new Error(`Could not parse class hash from: ${output}`);
  }

  console.log(`  Class hash: ${classHashMatch[1]}`);
  return classHashMatch[1];
}

function deployContract(
  classHash: string,
  calldata: string[]
): { address: string; txHash: string } {
  const calldataStr = calldata.join(" ");
  const output = sncast(
    `deploy --class-hash ${classHash} --constructor-calldata ${calldataStr}`
  );

  const addressMatch = output.match(
    /contract_address:\s*(0x[0-9a-fA-F]+)/
  );
  const txMatch = output.match(
    /transaction_hash:\s*(0x[0-9a-fA-F]+)/
  );

  if (!addressMatch) {
    throw new Error(`Could not parse address from: ${output}`);
  }

  return {
    address: addressMatch[1],
    txHash: txMatch ? txMatch[1] : "unknown",
  };
}

async function main() {
  const network = getNetwork();
  console.log(`\n========================================`);
  console.log(`  Moonight Protocol Deployment`);
  console.log(`  Network: ${network}`);
  console.log(`========================================\n`);

  if (network === "mainnet") {
    console.log("WARNING: You are deploying to MAINNET!");
    console.log("Press Ctrl+C within 5 seconds to abort...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Verify build artifacts exist
  if (!existsSync(TARGET_DIR)) {
    console.error("Build artifacts not found. Run 'scarb build' first.");
    process.exit(1);
  }

  const deployment: Deployment = {
    network,
    timestamp: new Date().toISOString(),
    contracts: {},
  };

  // Use a placeholder owner address (replace with actual deployer)
  const ownerAddress =
    process.env.OWNER_ADDRESS || "0x0"; // Must be set
  const treasuryAddress =
    process.env.TREASURY_ADDRESS || ownerAddress;

  console.log(`Owner: ${ownerAddress}`);
  console.log(`Treasury: ${treasuryAddress}\n`);

  console.log("Step 1: Declaring all contracts...\n");

  const classHashes: Record<string, string> = {};
  for (const name of DEPLOY_ORDER) {
    try {
      classHashes[name] = declareContract(name);
    } catch (e) {
      console.error(`Failed to declare ${name}:`, e);
      process.exit(1);
    }
  }

  console.log("\nStep 2: Deploying contracts...\n");

  // Deploy MoonUSD
  console.log("Deploying MoonUSD...");
  const moonusd = deployContract(classHashes.MoonUSD, [ownerAddress]);
  deployment.contracts.MoonUSD = {
    name: "MoonUSD",
    classHash: classHashes.MoonUSD,
    ...moonusd,
  };

  // Deploy PositionNFT
  console.log("Deploying PositionNFT...");
  const positionNft = deployContract(classHashes.PositionNFT, [
    ownerAddress,
  ]);
  deployment.contracts.PositionNFT = {
    name: "PositionNFT",
    classHash: classHashes.PositionNFT,
    ...positionNft,
  };

  // Deploy Mock WBTC (testnet only)
  if (network === "sepolia") {
    console.log("Deploying Mock WBTC (testnet)...");
    const mockWbtc = deployContract(classHashes.MockERC20, [
      "0x5772617070656420425443", // "Wrapped BTC" as felt
      "0x57425443", // "WBTC" as felt
    ]);
    deployment.contracts.MockWBTC = {
      name: "MockERC20 (WBTC)",
      classHash: classHashes.MockERC20,
      ...mockWbtc,
    };
  }

  // Deploy PriceOracle
  console.log("Deploying PriceOracle...");
  const priceOracle = deployContract(classHashes.PriceOracle, [
    ownerAddress,
    "0x0", // Pragma oracle address (set after deployment)
  ]);
  deployment.contracts.PriceOracle = {
    name: "PriceOracle",
    classHash: classHashes.PriceOracle,
    ...priceOracle,
  };

  // Deploy StabilityPool
  console.log("Deploying StabilityPool...");
  const stabilityPool = deployContract(classHashes.StabilityPool, [
    ownerAddress,
    moonusd.address,
  ]);
  deployment.contracts.StabilityPool = {
    name: "StabilityPool",
    classHash: classHashes.StabilityPool,
    ...stabilityPool,
  };

  // Deploy RedemptionManager
  console.log("Deploying RedemptionManager...");
  const redemptionManager = deployContract(
    classHashes.RedemptionManager,
    [ownerAddress, moonusd.address, priceOracle.address]
  );
  deployment.contracts.RedemptionManager = {
    name: "RedemptionManager",
    classHash: classHashes.RedemptionManager,
    ...redemptionManager,
  };

  // Deploy ProtocolConfig
  console.log("Deploying ProtocolConfig...");
  const protocolConfig = deployContract(classHashes.ProtocolConfig, [
    ownerAddress,
    treasuryAddress,
  ]);
  deployment.contracts.ProtocolConfig = {
    name: "ProtocolConfig",
    classHash: classHashes.ProtocolConfig,
    ...protocolConfig,
  };

  // Deploy CDPManager
  console.log("Deploying CDPManager...");
  const cdpManager = deployContract(classHashes.CDPManager, [
    ownerAddress,
    moonusd.address,
    positionNft.address,
    priceOracle.address,
    stabilityPool.address,
    redemptionManager.address,
    protocolConfig.address,
    treasuryAddress,
  ]);
  deployment.contracts.CDPManager = {
    name: "CDPManager",
    classHash: classHashes.CDPManager,
    ...cdpManager,
  };

  // Save deployment
  if (!existsSync(DEPLOY_DIR)) {
    execSync(`mkdir -p ${DEPLOY_DIR}`);
  }
  const deployFile = join(
    DEPLOY_DIR,
    `${network}-${Date.now()}.json`
  );
  writeFileSync(deployFile, JSON.stringify(deployment, null, 2));

  // Also save as latest
  const latestFile = join(DEPLOY_DIR, `${network}-latest.json`);
  writeFileSync(latestFile, JSON.stringify(deployment, null, 2));

  console.log(`\n========================================`);
  console.log(`  Deployment Complete!`);
  console.log(`  Saved to: ${deployFile}`);
  console.log(`========================================\n`);

  console.log("Contract Addresses:");
  for (const [key, contract] of Object.entries(deployment.contracts)) {
    console.log(`  ${key}: ${contract.address}`);
  }

  console.log(
    "\nNext steps:"
  );
  console.log(
    "  1. Wire up permissions (set CDPManager on PositionNFT, add minter/burner on MoonUSD)"
  );
  console.log("  2. Add collateral types to CDPManager");
  console.log(
    "  3. Set oracle asset keys"
  );
  console.log(
    "  4. Update frontend contract addresses in useMoonightContracts.ts"
  );
}

main().catch(console.error);
