import { RainClient } from "./rain-client.js";
import { createLogger } from "../../utils/logger.js";
import type { AutoTopupSettings } from "../../types/rain.js";

const log = createLogger("card-service");

export class CardService {
  private rainClient: RainClient;

  constructor() {
    this.rainClient = new RainClient();
  }

  async initiateKyc(data: {
    walletAddress: string;
    name: string;
    email: string;
    address: {
      line1: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    dob: string;
  }): Promise<{ cardholderId: string; kycUrl: string }> {
    log.info({ wallet: data.walletAddress }, "Initiating KYC");
    const result = await this.rainClient.createCardholder({
      name: data.name,
      email: data.email,
      address: data.address,
      dob: data.dob,
    });
    return { cardholderId: result.id, kycUrl: result.kycUrl };
  }

  async issueCard(
    cardholderId: string
  ): Promise<{ cardId: string; lastFour: string }> {
    log.info({ cardholderId }, "Issuing card");
    const card = await this.rainClient.issueCard(cardholderId);
    return { cardId: card.id, lastFour: card.lastFour };
  }

  async topUpCard(
    cardId: string,
    amountUsd: number
  ): Promise<{ txId: string }> {
    log.info({ cardId, amountUsd }, "Topping up card");
    const result = await this.rainClient.fundCard(cardId, amountUsd);
    return { txId: result.id };
  }

  async getCardBalance(cardId: string): Promise<number> {
    const result = await this.rainClient.getBalance(cardId);
    return result.balanceUsd;
  }

  async checkAutoTopup(
    cardId: string,
    settings: AutoTopupSettings,
    lastTopupAt: Date | null
  ): Promise<boolean> {
    if (!settings.enabled) return false;

    if (lastTopupAt) {
      const hoursSince =
        (Date.now() - lastTopupAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < settings.frequencyCapHours) {
        log.debug(
          { cardId, hoursSince },
          "Auto-topup frequency cap not met"
        );
        return false;
      }
    }

    const balance = await this.getCardBalance(cardId);
    if (balance >= settings.threshold) return false;

    log.info(
      { cardId, balance, threshold: settings.threshold },
      "Auto-topup triggered"
    );
    await this.topUpCard(cardId, settings.amount);
    return true;
  }
}
