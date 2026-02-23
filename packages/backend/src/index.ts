import { createLogger } from "./utils/logger.js";
import { config } from "./config.js";
import { startServer } from "./server.js";
import { PriceMonitor } from "./services/oracle/price-monitor.js";
import { LiquidationBot } from "./services/keeper/liquidation-bot.js";
import { VaultAKeeper } from "./services/keeper/vault-a-keeper.js";
import { VaultCKeeper } from "./services/keeper/vault-c-keeper.js";
import { EventIndexer } from "./services/indexer/event-indexer.js";

const log = createLogger("main");

async function main() {
  log.info(
    { network: config.STARKNET_NETWORK, env: config.NODE_ENV },
    "Starting Moonight backend"
  );

  // Initialize services
  const priceMonitor = new PriceMonitor();
  const liquidationBot = new LiquidationBot();
  const vaultAKeeper = new VaultAKeeper();
  const vaultCKeeper = new VaultCKeeper();

  const eventIndexer = new EventIndexer({
    onPositionOpened: (id) => liquidationBot.addPosition(id),
    onPositionClosed: (id) => liquidationBot.removePosition(id),
  });

  // Start services
  priceMonitor.start();
  liquidationBot.start();
  vaultAKeeper.start();
  vaultCKeeper.start();
  eventIndexer.start();

  // Start HTTP server
  startServer(priceMonitor);

  // Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down...");
    priceMonitor.stop();
    liquidationBot.stop();
    vaultAKeeper.stop();
    vaultCKeeper.stop();
    eventIndexer.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  log.fatal({ error }, "Fatal error");
  process.exit(1);
});
