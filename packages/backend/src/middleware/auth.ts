import type { Request, Response, NextFunction } from "express";
import { createLogger } from "../utils/logger.js";

const log = createLogger("auth");

export function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      next();
      return;
    }
    res.status(401).json({ error: "Missing API key" });
    return;
  }
  next();
}
