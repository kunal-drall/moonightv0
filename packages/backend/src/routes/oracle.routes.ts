import { Router } from "express";
import type { PriceMonitor } from "../services/oracle/price-monitor.js";

export function createOracleRouter(priceMonitor: PriceMonitor): Router {
  const router = Router();

  router.get("/api/oracle/prices", (_req, res) => {
    const prices = priceMonitor.getLatestPrices();
    if (!prices) {
      res.status(503).json({ error: "Prices not available yet" });
      return;
    }
    res.json(prices);
  });

  return router;
}
