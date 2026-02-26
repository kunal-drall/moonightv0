import { Router } from "express";
import { createLogger } from "../utils/logger.js";

const log = createLogger("vault-routes");

export function createVaultRouter(): Router {
  const router = Router();

  router.get("/api/vault-a/stats", async (_req, res) => {
    // TODO: Read from contract when deployed
    res.json({
      tvl: "0",
      delta: "0",
      fundingRate: "0",
      apy: "0",
    });
  });

  router.get("/api/vault-c/stats", async (_req, res) => {
    // TODO: Read from contract when deployed
    res.json({
      tvl: "0",
      pricePerShare: "1.0",
      apy: "0",
      allocations: { stabilityPool: 0, ekubo: 0, layerzero: 0 },
    });
  });

  return router;
}
