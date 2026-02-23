import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Starknet
  STARKNET_RPC_URL: z.string().default("https://starknet-sepolia.public.blastapi.io/rpc/v0_7"),
  STARKNET_NETWORK: z.enum(["sepolia", "mainnet"]).default("sepolia"),

  // Keeper
  KEEPER_PRIVATE_KEY: z.string().default("0x0"),
  KEEPER_ADDRESS: z.string().default("0x0"),

  // Contract addresses
  CDP_MANAGER_ADDRESS: z.string().default("0x0"),
  MOONUSD_ADDRESS: z.string().default("0x0"),
  PRICE_ORACLE_ADDRESS: z.string().default("0x0"),
  STABILITY_POOL_ADDRESS: z.string().default("0x0"),
  REDEMPTION_MANAGER_ADDRESS: z.string().default("0x0"),
  VAULT_A_ADDRESS: z.string().default("0x0"),
  VAULT_C_ADDRESS: z.string().default("0x0"),
  PROTOCOL_CONFIG_ADDRESS: z.string().default("0x0"),

  // Rain.xyz
  RAIN_API_KEY: z.string().default(""),
  RAIN_BASE_URL: z.string().default("https://sandbox.rain.xyz/v1"),
  RAIN_WEBHOOK_SECRET: z.string().default(""),

  // Monitoring
  DISCORD_WEBHOOK_URL: z.string().default(""),

  // Database
  DATABASE_PATH: z.string().default("./data/moonight.db"),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
