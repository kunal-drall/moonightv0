import { getProvider } from "../../utils/starknet.js";
import { createLogger } from "../../utils/logger.js";
import { config } from "../../config.js";

const log = createLogger("event-indexer");

export class EventIndexer {
  private lastProcessedBlock = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onPositionOpened?: (positionId: string, owner: string) => void;
  private onPositionClosed?: (positionId: string) => void;

  constructor(callbacks?: {
    onPositionOpened?: (positionId: string, owner: string) => void;
    onPositionClosed?: (positionId: string) => void;
  }) {
    this.onPositionOpened = callbacks?.onPositionOpened;
    this.onPositionClosed = callbacks?.onPositionClosed;
  }

  start(intervalMs = 10_000): void {
    log.info({ intervalMs }, "Event indexer started");
    this.poll();
    this.intervalId = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log.info("Event indexer stopped");
  }

  private async poll(): Promise<void> {
    try {
      const provider = getProvider();
      const latestBlock = await provider.getBlockNumber();

      if (latestBlock <= this.lastProcessedBlock) return;

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(latestBlock, fromBlock + 100);

      log.debug({ fromBlock, toBlock }, "Processing blocks");

      const events = await provider.getEvents({
        address: config.CDP_MANAGER_ADDRESS,
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        keys: [],
        chunk_size: 100,
      });

      for (const event of events.events) {
        const eventKey = event.keys[0];

        // PositionOpened event — replace with actual selector hash
        if (eventKey === "0x01") {
          const positionId = event.data[0];
          const owner = event.data[1];
          log.info({ positionId, owner }, "Position opened");
          this.onPositionOpened?.(positionId, owner);
        }

        // PositionClosed event
        if (eventKey === "0x02") {
          const positionId = event.data[0];
          log.info({ positionId }, "Position closed");
          this.onPositionClosed?.(positionId);
        }
      }

      this.lastProcessedBlock = toBlock;
    } catch (error) {
      log.error({ error }, "Event indexer poll failed");
    }
  }
}
