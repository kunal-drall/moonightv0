import { Router, raw } from "express";
import {
  verifyWebhookSignature,
  handleWebhookEvent,
} from "../services/card/webhook-handler.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("webhook-routes");

export function createWebhookRouter(): Router {
  const router = Router();

  router.post(
    "/webhook/rain",
    raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["x-rain-signature"] as string;
      const payload = req.body.toString();

      if (!verifyWebhookSignature(payload, signature)) {
        log.warn("Invalid webhook signature");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      try {
        const event = JSON.parse(payload);
        await handleWebhookEvent(event);
        res.json({ received: true });
      } catch (error) {
        log.error({ error }, "Webhook processing failed");
        res.status(500).json({ error: "Processing failed" });
      }
    }
  );

  return router;
}
