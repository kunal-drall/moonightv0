import { BaseKeeper } from "./base-keeper.js";
import { config } from "../../config.js";

export class VaultCKeeper extends BaseKeeper {
  private lastReallocAt = 0;

  constructor() {
    super("vault-c", 24 * 60 * 60 * 1000); // 24 hours
  }

  async tick(): Promise<void> {
    this.log.info("Running Vault C compound...");

    try {
      // Step 1: Compound yields
      const compoundTx = await this.executeTx([
        {
          contractAddress: config.VAULT_C_ADDRESS,
          entrypoint: "compound",
          calldata: [],
        },
      ]);
      this.log.info({ txHash: compoundTx }, "Vault C compounded");

      // Step 2: Reallocate weekly
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (now - this.lastReallocAt > oneWeek) {
        const reallocTx = await this.executeTx([
          {
            contractAddress: config.VAULT_C_ADDRESS,
            entrypoint: "reallocate",
            calldata: [],
          },
        ]);
        this.log.info({ txHash: reallocTx }, "Vault C reallocated");
        this.lastReallocAt = now;
      }
    } catch (error) {
      this.log.error({ error }, "Vault C keeper tick failed");
      throw error;
    }
  }
}
