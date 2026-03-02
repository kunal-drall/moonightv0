import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletAddress: text("wallet_address").notNull().unique(),
  rainCardholderId: text("rain_cardholder_id"),
  inviteCode: text("invite_code"),
  kycStatus: text("kyc_status", { enum: ["none", "pending", "approved", "rejected"] })
    .notNull()
    .default("none"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  rainCardId: text("rain_card_id").notNull(),
  lastFour: text("last_four").notNull(),
  autoTopupEnabled: integer("auto_topup_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  topupThreshold: real("topup_threshold").default(50),
  topupAmount: real("topup_amount").default(200),
  topupFrequencyCapHours: integer("topup_frequency_cap_hours").default(24),
  lastTopupAt: integer("last_topup_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id")
    .notNull()
    .references(() => cards.id),
  rainTxId: text("rain_tx_id").notNull(),
  amount: real("amount").notNull(),
  merchant: text("merchant"),
  category: text("category"),
  status: text("status", { enum: ["authorized", "settled", "declined"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const keeperEvents = sqliteTable("keeper_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keeperType: text("keeper_type").notNull(),
  action: text("action").notNull(),
  txHash: text("tx_hash"),
  status: text("status", { enum: ["success", "failed"] }).notNull(),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const inviteCodes = sqliteTable("invite_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  maxUses: integer("max_uses").notNull().default(1),
  usesCount: integer("uses_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});

export const positions = sqliteTable("positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  positionId: text("position_id").notNull().unique(),
  owner: text("owner").notNull(),
  collateralType: text("collateral_type").notNull(),
  status: text("status", { enum: ["active", "closed", "liquidated"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
