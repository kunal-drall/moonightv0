import { createHmac } from "crypto";
import { createLogger } from "../../utils/logger.js";
import { config } from "../../config.js";
import type { RainWebhookEvent } from "../../types/rain.js";

const log = createLogger("webhook-handler");

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!config.RAIN_WEBHOOK_SECRET) {
    log.warn("No webhook secret configured, skipping verification");
    return true;
  }

  const expected = createHmac("sha256", config.RAIN_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return expected === signature;
}

export async function handleWebhookEvent(
  event: RainWebhookEvent
): Promise<void> {
  log.info({ type: event.type, id: event.id }, "Processing webhook event");

  switch (event.type) {
    case "cardholder.kyc_approved":
      log.info({ data: event.data }, "KYC approved");
      break;

    case "cardholder.kyc_rejected":
      log.warn({ data: event.data }, "KYC rejected");
      break;

    case "transaction.authorized":
      log.info({ data: event.data }, "Transaction authorized");
      break;

    case "transaction.settled":
      log.info({ data: event.data }, "Transaction settled");
      break;

    case "balance.low":
      log.info({ data: event.data }, "Low balance alert");
      break;

    default:
      log.debug({ type: event.type }, "Unhandled webhook event type");
  }
}
