import { Router } from "express";
import { eq } from "drizzle-orm";
import { CardService } from "../services/card/card-service.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { createLogger } from "../utils/logger.js";
import { getDb } from "../db/client.js";
import { inviteCodes, users } from "../db/schema.js";

const log = createLogger("card-routes");

export function createCardRouter(): Router {
  const router = Router();
  const cardService = new CardService();

  /** Validate an invite code for a wallet address */
  router.post("/api/card/validate-invite", async (req, res) => {
    try {
      const { code, walletAddress } = req.body;
      if (!code || !walletAddress) {
        res.status(400).json({ error: "Missing code or walletAddress" });
        return;
      }

      const db = getDb();

      // Check if wallet already redeemed an invite code
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, walletAddress))
        .limit(1);

      if (existingUser?.inviteCode) {
        res.json({ valid: true, alreadyRedeemed: true });
        return;
      }

      // Look up the invite code
      const [invite] = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, code.trim().toUpperCase()))
        .limit(1);

      if (!invite) {
        res.status(400).json({ error: "Invalid invite code" });
        return;
      }

      if (invite.usesCount >= invite.maxUses) {
        res.status(400).json({ error: "Invite code has been fully used" });
        return;
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        res.status(400).json({ error: "Invite code has expired" });
        return;
      }

      // Increment uses_count
      await db
        .update(inviteCodes)
        .set({ usesCount: invite.usesCount + 1 })
        .where(eq(inviteCodes.id, invite.id));

      // Upsert user with invite code
      if (existingUser) {
        await db
          .update(users)
          .set({ inviteCode: invite.code })
          .where(eq(users.walletAddress, walletAddress));
      } else {
        await db.insert(users).values({
          walletAddress,
          inviteCode: invite.code,
        });
      }

      log.info({ code: invite.code, walletAddress }, "Invite code redeemed");
      res.json({ valid: true });
    } catch (error) {
      log.error({ error }, "Invite code validation failed");
      res.status(500).json({ error: "Validation failed" });
    }
  });

  /** Admin: create an invite code (protected by admin API key) */
  router.post("/api/admin/invite-codes", async (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_API_KEY) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const { code, maxUses, expiresAt } = req.body;
      if (!code) {
        res.status(400).json({ error: "Missing code" });
        return;
      }

      const db = getDb();
      const normalizedCode = code.trim().toUpperCase();

      await db.insert(inviteCodes).values({
        code: normalizedCode,
        maxUses: maxUses ?? 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      log.info({ code: normalizedCode, maxUses }, "Invite code created");
      res.json({ success: true, code: normalizedCode });
    } catch (error) {
      log.error({ error }, "Invite code creation failed");
      res.status(500).json({ error: "Failed to create invite code" });
    }
  });

  /** Admin: list all invite codes */
  router.get("/api/admin/invite-codes", async (req, res) => {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_API_KEY) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const db = getDb();
      const codes = await db.select().from(inviteCodes);
      res.json({ codes });
    } catch (error) {
      log.error({ error }, "Failed to list invite codes");
      res.status(500).json({ error: "Failed to list invite codes" });
    }
  });

  router.post("/api/card/kyc", apiKeyAuth, async (req, res) => {
    try {
      const { inviteCode: code, walletAddress, ...kycData } = req.body;

      // Verify the wallet has a valid invite code before allowing KYC
      if (walletAddress) {
        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.walletAddress, walletAddress))
          .limit(1);

        if (!user?.inviteCode) {
          res.status(403).json({ error: "Valid invite code required to start KYC" });
          return;
        }
      }

      const result = await cardService.initiateKyc({ ...kycData, walletAddress });
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
