import { createLogger } from "./logger.js";
import { config } from "../config.js";

const log = createLogger("alerts");

export type AlertSeverity = "info" | "warning" | "critical";

export async function sendAlert(
  title: string,
  message: string,
  severity: AlertSeverity = "warning"
): Promise<void> {
  log.warn({ title, message, severity }, "Alert triggered");

  if (!config.DISCORD_WEBHOOK_URL) return;

  const color =
    severity === "critical" ? 0xff0000 : severity === "warning" ? 0xffaa00 : 0x00aa00;

  try {
    await fetch(config.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `[${severity.toUpperCase()}] ${title}`,
            description: message,
            color,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    log.error({ error }, "Failed to send Discord alert");
  }
}
