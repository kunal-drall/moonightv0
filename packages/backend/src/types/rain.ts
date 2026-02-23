export interface RainCardholder {
  id: string;
  name: string;
  email: string;
  kycStatus: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface RainCard {
  id: string;
  cardholderId: string;
  lastFour: string;
  expiry: string;
  type: "virtual" | "physical";
  status: "active" | "frozen" | "cancelled";
}

export interface RainTransaction {
  id: string;
  cardId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  status: "authorized" | "settled" | "declined";
  createdAt: string;
}

export interface RainWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface CardTopupRequest {
  cardId: string;
  amountUsd: number;
  sourceVault: "vault_c";
}

export interface AutoTopupSettings {
  enabled: boolean;
  threshold: number;
  amount: number;
  sourceVault: "vault_c";
  frequencyCapHours: number;
}
