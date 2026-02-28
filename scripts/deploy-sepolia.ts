/**
 * Moonight Protocol - Sepolia Deployment via starknet.js
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... DEPLOYER_ADDRESS=0x... tsx scripts/deploy-sepolia.ts
 */

import {
  RpcProvider,
  Account,
  Contract,
  json,
  stark,
  CallData,
  hash,
  type DeclareContractPayload,
} from "starknet";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TARGET_DIR = join(__dirname, "..", "packages", "contracts", "target", "dev");
const DEPLOY_DIR = join(__dirname, "..", "deployments");

const RPC_URL = process.env.STARKNET_RPC_URL || "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS!;

if (!PRIVATE_KEY || !DEPLOYER_ADDRESS) {
  console.error("Missing DEPLOYER_PRIVATE_KEY or DEPLOYER_ADDRESS");
  process.exit(1);
}

interface DeployResult {
  name: string;
  classHash: string;
  address: string;
  txHash: string;
}

function loadContractArtifacts(contractName: string) {
  const sierraPath = join(TARGET_DIR, `moonight_${contractName}.contract_class.json`);
  const casmPath = join(TARGET_DIR, `moonight_${contractName}.compiled_contract_class.json`);

  if (!existsSync(sierraPath)) {
    throw new Error(`Sierra not found for ${contractName}. Run 'scarb build' first.`);
  }

  const sierra = json.parse(readFileSync(sierraPath, "utf-8"));
  const casm = json.parse(readFileSync(casmPath, "utf-8"));
  return { sierra, casm };
}

async function main() {
  console.log("\n========================================");
  console.log("  Moonight Protocol - Sepolia Deployment");
  console.log("========================================\n");

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider,
    address: DEPLOYER_ADDRESS,
    signer: PRIVATE_KEY,
  });

  console.log(`Deployer: ${DEPLOYER_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  // Verify account
  try {
    const nonce = await account.getNonce();
    console.log(`Account nonce: ${nonce}\n`);
  } catch (e) {
    console.error("Failed to fetch account nonce. Is the address correct and funded?");
    console.error(e);
    process.exit(1);
  }

  const deployments: Record<string, DeployResult> = {};

  // Helper: declare + deploy
  async function declareAndDeploy(
    contractName: string,
    constructorCalldata: any[]
  ): Promise<DeployResult> {
    console.log(`\n--- ${contractName} ---`);

    const { sierra, casm } = loadContractArtifacts(contractName);

    // Step 1: Declare
    let classHash: string;
    try {
      console.log("  Declaring...");
      const declareResponse = await account.declare({
        contract: sierra,
        casm,
      });
      classHash = declareResponse.class_hash;
      console.log(`  Class hash: ${classHash}`);
      console.log(`  Declare TX: ${declareResponse.transaction_hash}`);
      await provider.waitForTransaction(declareResponse.transaction_hash);
      console.log("  Declare confirmed.");
    } catch (e: any) {
      if (e.message?.includes("already declared") || e.message?.includes("StarknetErrorCode.CLASS_ALREADY_DECLARED")) {
        // Extract class hash from compiled contract
        classHash = hash.computeContractClassHash(sierra);
        console.log(`  Already declared. Class hash: ${classHash}`);
      } else {
        throw e;
      }
    }

    // Step 2: Deploy
    console.log("  Deploying...");
    const deployResponse = await account.deployContract({
      classHash,
      constructorCalldata: CallData.compile(constructorCalldata),
    });
    console.log(`  Deploy TX: ${deployResponse.transaction_hash}`);
    await provider.waitForTransaction(deployResponse.transaction_hash);
    const address = deployResponse.contract_address;
    console.log(`  Address: ${address}`);

    return {
      name: contractName,
      classHash,
      address: address!,
      txHash: deployResponse.transaction_hash,
    };
  }

  try {
    // ===== Deploy in dependency order =====

    // 1. MoonUSD (owner)
    deployments.MoonUSD = await declareAndDeploy("MoonUSD", [DEPLOYER_ADDRESS]);

    // 2. PositionNFT (owner)
    deployments.PositionNFT = await declareAndDeploy("PositionNFT", [DEPLOYER_ADDRESS]);

    // 3. MockERC20 — skipped (not compiled as standalone contract)
    // For testnet WBTC, use ETH or a known Sepolia ERC20 address
    console.log("\n--- MockWBTC ---");
    console.log("  Skipped (test_utils contract, not standalone). Use ETH as collateral for testing.");

    // 4. PriceOracle (owner, pragma_address)
    // Use Pragma Sepolia address
    const pragmaAddress = "0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a";
    deployments.PriceOracle = await declareAndDeploy("PriceOracle", [
      DEPLOYER_ADDRESS,
      pragmaAddress,
    ]);

    // 5. StabilityPool (owner, moonusd)
    deployments.StabilityPool = await declareAndDeploy("StabilityPool", [
      DEPLOYER_ADDRESS,
      deployments.MoonUSD.address,
    ]);

    // 6. RedemptionManager (owner, moonusd, oracle)
    deployments.RedemptionManager = await declareAndDeploy("RedemptionManager", [
      DEPLOYER_ADDRESS,
      deployments.MoonUSD.address,
      deployments.PriceOracle.address,
    ]);

    // 7. ProtocolConfig (owner, treasury)
    deployments.ProtocolConfig = await declareAndDeploy("ProtocolConfig", [
      DEPLOYER_ADDRESS,
      DEPLOYER_ADDRESS, // Treasury = deployer for testnet
    ]);

    // 8. CDPManager (owner, moonusd, position_nft, oracle, sp, redemption, config, treasury)
    deployments.CDPManager = await declareAndDeploy("CDPManager", [
      DEPLOYER_ADDRESS,
      deployments.MoonUSD.address,
      deployments.PositionNFT.address,
      deployments.PriceOracle.address,
      deployments.StabilityPool.address,
      deployments.RedemptionManager.address,
      deployments.ProtocolConfig.address,
      DEPLOYER_ADDRESS, // Treasury
    ]);

    // ===== Save deployment =====
    if (!existsSync(DEPLOY_DIR)) {
      mkdirSync(DEPLOY_DIR, { recursive: true });
    }

    const deployment = {
      network: "sepolia",
      timestamp: new Date().toISOString(),
      deployer: DEPLOYER_ADDRESS,
      contracts: deployments,
    };

    const deployFile = join(DEPLOY_DIR, `sepolia-${Date.now()}.json`);
    const latestFile = join(DEPLOY_DIR, "sepolia-latest.json");
    writeFileSync(deployFile, JSON.stringify(deployment, null, 2));
    writeFileSync(latestFile, JSON.stringify(deployment, null, 2));

    console.log("\n========================================");
    console.log("  Deployment Complete!");
    console.log("========================================\n");
    console.log("Contract Addresses:");
    for (const [key, info] of Object.entries(deployments)) {
      console.log(`  ${key}: ${info.address}`);
    }
    console.log(`\nSaved to: ${deployFile}`);
    console.log("\nNext: Wire up permissions with the wiring script.");

  } catch (error) {
    console.error("\nDeployment failed:", error);

    // Save partial deployment for recovery
    if (Object.keys(deployments).length > 0) {
      if (!existsSync(DEPLOY_DIR)) mkdirSync(DEPLOY_DIR, { recursive: true });
      const partialFile = join(DEPLOY_DIR, `sepolia-partial-${Date.now()}.json`);
      writeFileSync(partialFile, JSON.stringify({
        network: "sepolia",
        timestamp: new Date().toISOString(),
        partial: true,
        contracts: deployments,
      }, null, 2));
      console.log(`\nPartial deployment saved to: ${partialFile}`);
    }
    process.exit(1);
  }
}

main();
