/**
 * Mint test WBTC on Sepolia to a recipient address.
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... DEPLOYER_ADDRESS=0x... \
 *     tsx scripts/mint-test-wbtc.ts <RECIPIENT> [AMOUNT_SATS]
 *
 * AMOUNT_SATS defaults to 100_000_000 (1 WBTC, 8 decimals).
 */

import { RpcProvider, Account, Contract, json, CallData, uint256 } from "starknet";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEPLOY_DIR = join(__dirname, "..", "deployments");
const TARGET_DIR = join(__dirname, "..", "packages", "contracts", "target", "dev");

const RPC_URL = process.env.STARKNET_RPC_URL || "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS!;

if (!PRIVATE_KEY || !DEPLOYER_ADDRESS) {
  console.error("Missing DEPLOYER_PRIVATE_KEY or DEPLOYER_ADDRESS");
  process.exit(1);
}

const recipient = process.argv[2];
if (!recipient) {
  console.error("Usage: tsx scripts/mint-test-wbtc.ts <RECIPIENT_ADDRESS> [AMOUNT_SATS]");
  console.error("  AMOUNT_SATS defaults to 100000000 (1 WBTC)");
  process.exit(1);
}

// Default: 1 WBTC = 100_000_000 sats (8 decimals)
const amountRaw = BigInt(process.argv[3] || "100000000");

async function main() {
  // Load MockWBTC address
  const deployFile = join(DEPLOY_DIR, "mock-wbtc-sepolia.json");
  if (!existsSync(deployFile)) {
    console.error("MockWBTC not deployed yet. Run deploy-mock-wbtc.ts first.");
    process.exit(1);
  }
  const deployment = JSON.parse(readFileSync(deployFile, "utf-8"));
  const wbtcAddress = deployment.address;

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider,
    address: DEPLOYER_ADDRESS,
    signer: PRIVATE_KEY,
  });

  // Load ABI
  const sierraPath = join(TARGET_DIR, "moonight_MockWBTC.contract_class.json");
  const sierra = json.parse(readFileSync(sierraPath, "utf-8"));
  const wbtc = new Contract(sierra.abi, wbtcAddress, account);

  const amountU256 = uint256.bnToUint256(amountRaw);
  const decimals = amountRaw === BigInt("100000000") ? "1" : (Number(amountRaw) / 1e8).toFixed(8);

  console.log(`\nMinting ${decimals} WBTC (${amountRaw} sats)`);
  console.log(`  To: ${recipient}`);
  console.log(`  MockWBTC: ${wbtcAddress}\n`);

  const tx = await wbtc.invoke("mint_to", [recipient, amountU256]);
  console.log(`  TX: ${tx.transaction_hash}`);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log("  Confirmed! Tokens minted.\n");
}

main().catch((err) => {
  console.error("Mint failed:", err);
  process.exit(1);
});
