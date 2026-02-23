import { RpcProvider, Account, type Call } from "starknet";
import { config } from "../config.js";
import { createLogger } from "./logger.js";

const log = createLogger("starknet");

export function getProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
}

export function getKeeperAccount(): Account {
  const provider = getProvider();
  return new Account({
    provider,
    address: config.KEEPER_ADDRESS,
    signer: config.KEEPER_PRIVATE_KEY,
  });
}

export async function executeWithRetry(
  account: Account,
  calls: Call[],
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const tx = await account.execute(calls);
      log.info({ txHash: tx.transaction_hash, attempt }, "Transaction submitted");
      const provider = getProvider();
      await provider.waitForTransaction(tx.transaction_hash);
      log.info({ txHash: tx.transaction_hash }, "Transaction confirmed");
      return tx.transaction_hash;
    } catch (error) {
      log.error({ attempt, error }, "Transaction failed");
      if (attempt === maxRetries - 1) throw error;
      const delay = 1000 * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("All retry attempts exhausted");
}
