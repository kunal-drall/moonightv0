import type { Request, Response, NextFunction } from "express";

const windowMs = 60_000;
const maxRequests = 100;

const requestCounts = new Map<
  string,
  { count: number; resetAt: number }
>();

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  next();
}
