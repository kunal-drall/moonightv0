import { Router } from "express";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  router.get("/readiness", async (_req, res) => {
    res.json({ status: "ready" });
  });

  return router;
}
