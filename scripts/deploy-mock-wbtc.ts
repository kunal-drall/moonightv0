/**
 * Deploy MockWBTC to Starknet Sepolia
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... DEPLOYER_ADDRESS=0x... tsx scripts/deploy-mock-wbtc.ts
 */

import {
  RpcProvider,
  Account,
  json,
  CallData,
  hash,
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

async function main() {
  console.log("\n========================================");
  console.log("  MockWBTC - Sepolia Deployment");
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
  const nonce = await account.getNonce();
  console.log(`Account nonce: ${nonce}\n`);

  // Load artifacts
  const sierraPath = join(TARGET_DIR, "moonight_MockWBTC.contract_class.json");
  const casmPath = join(TARGET_DIR, "moonight_MockWBTC.compiled_contract_class.json");

  if (!existsSync(sierraPath)) {
    console.error("MockWBTC artifacts not found. Build contracts first.");
    process.exit(1);
  }

  const sierra = json.parse(readFileSync(sierraPath, "utf-8"));
  const casm = json.parse(readFileSync(casmPath, "utf-8"));

  // Declare
  let classHash: string;
  try {
    console.log("Declaring MockWBTC...");
    const declareResponse = await account.declare({ contract: sierra, casm });
    classHash = declareResponse.class_hash;
    console.log(`  Class hash: ${classHash}`);
    console.log(`  Declare TX: ${declareResponse.transaction_hash}`);
    await provider.waitForTransaction(declareResponse.transaction_hash);
    console.log("  Declare confirmed.");
  } catch (e: any) {
    if (e.message?.includes("already declared") || e.message?.includes("CLASS_ALREADY_DECLARED")) {
      classHash = hash.computeContractClassHash(sierra);
      console.log(`  Already declared. Class hash: ${classHash}`);
    } else {
      throw e;
    }
  }

  // Deploy (no constructor args)
  console.log("Deploying MockWBTC...");
  const deployResponse = await account.deployContract({
    classHash,
    constructorCalldata: CallData.compile([]),
  });
  console.log(`  Deploy TX: ${deployResponse.transaction_hash}`);
  await provider.waitForTransaction(deployResponse.transaction_hash);
  const address = deployResponse.contract_address;
  console.log(`  Address: ${address}`);

  // Save deployment
  if (!existsSync(DEPLOY_DIR)) mkdirSync(DEPLOY_DIR, { recursive: true });

  const result = {
    network: "sepolia",
    timestamp: new Date().toISOString(),
    deployer: DEPLOYER_ADDRESS,
    contract: "MockWBTC",
    classHash,
    address,
    txHash: deployResponse.transaction_hash,
  };

  const outFile = join(DEPLOY_DIR, "mock-wbtc-sepolia.json");
  writeFileSync(outFile, JSON.stringify(result, null, 2));

  console.log("\n========================================");
  console.log("  MockWBTC Deployed!");
  console.log("========================================");
  console.log(`  Address: ${address}`);
  console.log(`  Saved to: ${outFile}`);
  console.log(`\nMint test WBTC:`);
  console.log(`  tsx scripts/mint-test-wbtc.ts <RECIPIENT_ADDRESS> <AMOUNT>`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
