import { Contract } from "starknet";
import { getProvider } from "../../utils/starknet.js";
import { createLogger } from "../../utils/logger.js";
import { sendAlert } from "../../utils/alerts.js";
import { config } from "../../config.js";
import type { PriceSnapshot } from "../../types/events.js";

const log = createLogger("price-monitor");

const ORACLE_ABI = [
  {
    name: "get_price",
    type: "function",
    inputs: [{ name: "collateral_key", type: "felt" }],
    outputs: [{ name: "price", type: "Uint256" }],
    stateMutability: "view",
  },
  {
    name: "is_emergency_mode",
    type: "function",
    inputs: [],
    outputs: [{ name: "is_emergency", type: "felt" }],
    stateMutability: "view",
  },
] as const;

const SCALE = 10n ** 18n;

export class PriceMonitor {
  private oracle: Contract;
  private lastSnapshot: PriceSnapshot | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const provider = getProvider();
    this.oracle = new Contract({
      abi: ORACLE_ABI as any,
      address: config.PRICE_ORACLE_ADDRESS,
      providerOrAccount: provider,
    });
  }

  start(intervalMs = 30_000): void {
    log.info({ intervalMs }, "Price monitor started");
    this.poll();
    this.intervalId = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log.info("Price monitor stopped");
  }

  getLatestPrices(): PriceSnapshot | null {
    return this.lastSnapshot;
  }

  private async poll(): Promise<void> {
    try {
      const provider = getProvider();
      const block = await provider.getBlockNumber();

      // Fetch BTC/USD price
      const btcPrice = await this.oracle.get_price("0x4254432f555344");
      const btcUsd = Number(BigInt(btcPrice.toString())) / Number(SCALE);

      // Fetch WBTC price (fall back to BTC price if not configured)
      let wbtcUsd = btcUsd;
      try {
        const wbtcPrice = await this.oracle.get_price("0x574254432f555344");
        wbtcUsd = Number(BigInt(wbtcPrice.toString())) / Number(SCALE);
      } catch {
        // WBTC feed may not be configured yet
      }

      const snapshot: PriceSnapshot = {
        btcUsd,
        wbtcUsd,
        timestamp: Date.now(),
        blockNumber: block,
      };

      // Check for price deviation
      if (this.lastSnapshot) {
        const deviation =
          Math.abs(snapshot.btcUsd - this.lastSnapshot.btcUsd) /
          this.lastSnapshot.btcUsd;
        if (deviation > 0.05) {
          await sendAlert(
            "Price Deviation",
            `BTC/USD moved ${(deviation * 100).toFixed(1)}% (${this.lastSnapshot.btcUsd.toFixed(0)} -> ${snapshot.btcUsd.toFixed(0)})`,
            "warning"
          );
        }
      }

      // Check emergency mode
      try {
        const emergency = await this.oracle.is_emergency_mode();
        if (emergency.toString() !== "0") {
          await sendAlert(
            "Oracle Emergency Mode",
            "Oracle has entered emergency mode!",
            "critical"
          );
        }
      } catch {
        // may not exist in older versions
      }

      this.lastSnapshot = snapshot;
      log.debug(
        { btcUsd: snapshot.btcUsd, block: snapshot.blockNumber },
        "Price updated"
      );
    } catch (error) {
      log.error({ error }, "Price poll failed");
    }
  }
}
