"use client";

import { StarkZap } from "starkzap";

const network =
  process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet"
    ? "mainnet"
    : "sepolia";

/**
 * Singleton StarkZap SDK instance.
 * Reused across the app for wallet connections, token ops, and staking.
 */
export const starkzapSdk = new StarkZap({ network });
