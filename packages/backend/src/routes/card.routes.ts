import { Router } from "express";
import { CardService } from "../services/card/card-service.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("card-routes");

export function createCardRouter(): Router {
  const router = Router();
  const cardService = new CardService();

  router.post("/api/card/kyc", apiKeyAuth, async (req, res) => {
    try {
      const result = await cardService.initiateKyc(req.body);
      res.json(result);
    } catch (error) {
      log.error({ error }, "KYC initiation failed");
      res.status(500).json({ error: "KYC initiation failed" });
    }
  });

  router.post("/api/card/topup", apiKeyAuth, async (req, res) => {
    try {
      const { cardId, amountUsd } = req.body;
      const result = await cardService.topUpCard(cardId, amountUsd);
      res.json(result);
    } catch (error) {
      log.error({ error }, "Card top-up failed");
      res.status(500).json({ error: "Card top-up failed" });
    }
  });

  router.get("/api/card/:cardId/balance", apiKeyAuth, async (req, res) => {
    try {
      const balance = await cardService.getCardBalance(req.params.cardId as string);
      res.json({ balanceUsd: balance });
    } catch (error) {
      log.error({ error }, "Balance check failed");
      res.status(500).json({ error: "Balance check failed" });
    }
  });

  return router;
}
