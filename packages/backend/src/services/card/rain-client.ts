import { createLogger } from "../../utils/logger.js";
import { config } from "../../config.js";
import type {
  RainCardholder,
  RainCard,
  RainTransaction,
} from "../../types/rain.js";

const log = createLogger("rain-client");

export class RainClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.RAIN_BASE_URL;
    this.apiKey = config.RAIN_API_KEY;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    log.debug({ method, path }, "Rain API request");

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Rain API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async createCardholder(data: {
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
  }): Promise<{ id: string; kycUrl: string }> {
    return this.request("POST", "/cardholders", data);
  }

  async getCardholder(id: string): Promise<RainCardholder> {
    return this.request("GET", `/cardholders/${id}`);
  }

  async issueCard(
    cardholderId: string,
    type: "virtual" | "physical" = "virtual"
  ): Promise<RainCard> {
    return this.request("POST", "/cards", { cardholderId, type });
  }

  async getCard(cardId: string): Promise<RainCard> {
    return this.request("GET", `/cards/${cardId}`);
  }

  async fundCard(
    cardId: string,
    amountUsd: number
  ): Promise<{ id: string; status: string }> {
    return this.request("POST", `/cards/${cardId}/fund`, {
      amount: amountUsd,
      currency: "USD",
    });
  }

  async getBalance(cardId: string): Promise<{ balanceUsd: number }> {
    return this.request("GET", `/cards/${cardId}/balance`);
  }

  async getTransactions(
    cardId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<RainTransaction[]> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.offset) params.set("offset", String(opts.offset));
    return this.request(
      "GET",
      `/cards/${cardId}/transactions?${params}`
    );
  }
}
