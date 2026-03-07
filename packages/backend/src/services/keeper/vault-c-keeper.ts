import { BaseKeeper } from "./base-keeper.js";
import { config } from "../../config.js";

export class VaultCKeeper extends BaseKeeper {
  private lastReallocAt = 0;
  private lastApyUpdateAt = 0;

  constructor() {
    super("vault-c", 23 * 60 * 60 * 1000); // 23 hours (matches on-chain compound interval)
  }

  async tick(): Promise<void> {
    this.log.info("Running Vault C keeper cycle...");

    try {
      // Step 1: Compound yields (every 23h)
      const compoundTx = await this.executeTx([
        {
          contractAddress: config.VAULT_C_ADDRESS,
          entrypoint: "compound",
          calldata: [],
        },
      ]);
      this.log.info({ txHash: compoundTx }, "Vault C compounded");

      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;

      // Step 2: Update adapter APYs every 6h
      if (now - this.lastApyUpdateAt > sixHours) {
        await this.updateAdapterApys();
        this.lastApyUpdateAt = now;
      }

      // Step 3: Reallocate every 6h (softmax rebalance)
      if (now - this.lastReallocAt > sixHours) {
        const reallocTx = await this.executeTx([
          {
            contractAddress: config.VAULT_C_ADDRESS,
            entrypoint: "reallocate",
            calldata: [],
          },
        ]);
        this.log.info({ txHash: reallocTx }, "Vault C reallocated via softmax");
        this.lastReallocAt = now;
      }
    } catch (error) {
      this.log.error({ error }, "Vault C keeper tick failed");
      throw error;
    }
  }

  private async updateAdapterApys(): Promise<void> {
    // Update SP adapter APY based on observed yields
    // For now, use conservative estimates until live data is available
    const spApyBps = 850; // 8.5% default estimate

    try {
      const tx = await this.executeTx([
        {
          contractAddress: config.SP_ADAPTER_ADDRESS ?? "",
          entrypoint: "set_apy_bps",
          calldata: [spApyBps.toString(), "0"], // u256 low, high
        },
      ]);
      this.log.info({ txHash: tx, spApyBps }, "Updated adapter APYs");
    } catch (error) {
      this.log.warn({ error }, "Failed to update adapter APYs (non-fatal)");
    }
  }
}
