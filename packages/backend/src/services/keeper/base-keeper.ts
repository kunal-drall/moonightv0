import { Account, type Call } from "starknet";
import { getKeeperAccount, executeWithRetry } from "../../utils/starknet.js";
import { createLogger } from "../../utils/logger.js";
import { sendAlert } from "../../utils/alerts.js";
import type { Logger } from "pino";

export abstract class BaseKeeper {
  protected account: Account;
  protected log: Logger;
  protected isRunning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    protected name: string,
    protected intervalMs: number
  ) {
    this.account = getKeeperAccount();
    this.log = createLogger(`keeper:${name}`);
  }

  abstract tick(): Promise<void>;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log.info({ intervalMs: this.intervalMs }, "Keeper started");

    this.runTick();
    this.intervalId = setInterval(() => this.runTick(), this.intervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.log.info("Keeper stopped");
  }

  private async runTick(): Promise<void> {
    try {
      await this.tick();
    } catch (error) {
      this.log.error({ error }, "Keeper tick failed");
      await sendAlert(
        `${this.name} Keeper Error`,
        `Tick failed: ${error instanceof Error ? error.message : String(error)}`,
        "warning"
      );
    }
  }

  protected async executeTx(calls: Call[]): Promise<string> {
    return executeWithRetry(this.account, calls);
  }
}
