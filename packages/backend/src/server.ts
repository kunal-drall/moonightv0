import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { createLogger } from "./utils/logger.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createOracleRouter } from "./routes/oracle.routes.js";
import { createCardRouter } from "./routes/card.routes.js";
import { createWebhookRouter } from "./routes/webhook.routes.js";
import { createVaultRouter } from "./routes/vault.routes.js";
import type { PriceMonitor } from "./services/oracle/price-monitor.js";

const log = createLogger("server");

export function createServer(priceMonitor: PriceMonitor): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(rateLimiter);
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createOracleRouter(priceMonitor));
  app.use(createCardRouter());
  app.use(createWebhookRouter());
  app.use(createVaultRouter());

  return app;
}

export function startServer(priceMonitor: PriceMonitor): void {
  const app = createServer(priceMonitor);
  app.listen(config.PORT, () => {
    log.info({ port: config.PORT }, "Server started");
  });
}
