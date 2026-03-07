import type { Token } from "starkzap";
import type { Address } from "starkzap";

/**
 * Custom Moonight token definitions for starkzap SDK.
 * These work with Amount.parse(), wallet.balanceOf(), TxBuilder.approve(), etc.
 */

export const moonUSD: Token = {
  address: (process.env.NEXT_PUBLIC_MOONUSD || "0x0") as Address,
  symbol: "moonUSD",
  decimals: 18,
  name: "Moon USD",
};

export const WBTC: Token = {
  address: (process.env.NEXT_PUBLIC_MOCK_WBTC || "0x0") as Address,
  symbol: "WBTC",
  decimals: 8,
  name: "Wrapped Bitcoin",
};
