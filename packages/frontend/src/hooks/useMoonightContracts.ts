"use client";

import { useMemo } from "react";

/**
 * Contract addresses loaded from environment variables.
 * Set via .env.sepolia or .env.mainnet depending on deployment target.
 */
const CONTRACT_ADDRESSES = {
  moonUSD: process.env.NEXT_PUBLIC_MOONUSD || "0x0",
  cdpManager: process.env.NEXT_PUBLIC_CDP_MANAGER || "0x0",
  positionNFT: process.env.NEXT_PUBLIC_POSITION_NFT || "0x0",
  priceOracle: process.env.NEXT_PUBLIC_PRICE_ORACLE || "0x0",
  stabilityPool: process.env.NEXT_PUBLIC_STABILITY_POOL || "0x0",
  redemptionManager: process.env.NEXT_PUBLIC_REDEMPTION_MANAGER || "0x0",
  protocolConfig: process.env.NEXT_PUBLIC_PROTOCOL_CONFIG || "0x0",
} as const;

/**
 * Minimal ABIs for interacting with Moonight Protocol contracts.
 * Replace with full generated ABIs after contract compilation.
 */
const ABIS = {
  erc20: [
    {
      name: "balance_of",
      type: "function",
      inputs: [{ name: "account", type: "felt" }],
      outputs: [{ name: "balance", type: "Uint256" }],
      state_mutability: "view",
    },
    {
      name: "approve",
      type: "function",
      inputs: [
        { name: "spender", type: "felt" },
        { name: "amount", type: "Uint256" },
      ],
      outputs: [{ name: "success", type: "felt" }],
      state_mutability: "external",
    },
    {
      name: "transfer",
      type: "function",
      inputs: [
        { name: "recipient", type: "felt" },
        { name: "amount", type: "Uint256" },
      ],
      outputs: [{ name: "success", type: "felt" }],
      state_mutability: "external",
    },
    {
      name: "total_supply",
      type: "function",
      inputs: [],
      outputs: [{ name: "total_supply", type: "Uint256" }],
      state_mutability: "view",
    },
  ],

  cdpManager: [
    {
      name: "open_position",
      type: "function",
      inputs: [
        { name: "collateral_type", type: "felt" },
        { name: "collateral_amount", type: "Uint256" },
        { name: "debt_amount", type: "Uint256" },
        { name: "interest_rate_bps", type: "felt" },
      ],
      outputs: [{ name: "position_id", type: "felt" }],
      state_mutability: "external",
    },
    {
      name: "close_position",
      type: "function",
      inputs: [{ name: "position_id", type: "felt" }],
      outputs: [],
      state_mutability: "external",
    },
    {
      name: "deposit_collateral",
      type: "function",
      inputs: [
        { name: "position_id", type: "felt" },
        { name: "amount", type: "Uint256" },
      ],
      outputs: [],
      state_mutability: "external",
    },
    {
      name: "withdraw_collateral",
      type: "function",
      inputs: [
        { name: "position_id", type: "felt" },
        { name: "amount", type: "Uint256" },
      ],
      outputs: [],
      state_mutability: "external",
    },
    {
      name: "mint_debt",
      type: "function",
      inputs: [
        { name: "position_id", type: "felt" },
        { name: "amount", type: "Uint256" },
      ],
      outputs: [],
      state_mutability: "external",
    },
    {
      name: "repay_debt",
      type: "function",
      inputs: [
        { name: "position_id", type: "felt" },
        { name: "amount", type: "Uint256" },
      ],
      outputs: [],
      state_mutability: "external",
    },
    {
      name: "get_position",
      type: "function",
      inputs: [{ name: "position_id", type: "felt" }],
      outputs: [
        { name: "owner", type: "felt" },
        { name: "collateral", type: "Uint256" },
        { name: "debt", type: "Uint256" },
        { name: "interest_rate", type: "felt" },
      ],
      state_mutability: "view",
    },
    {
      name: "get_health_factor",
      type: "function",
      inputs: [{ name: "position_id", type: "felt" }],
      outputs: [{ name: "health_factor", type: "Uint256" }],
      state_mutability: "view",
    },
  ],

  erc4626Vault: [
    {
      name: "deposit",
      type: "function",
      inputs: [
        { name: "assets", type: "Uint256" },
        { name: "receiver", type: "felt" },
      ],
      outputs: [{ name: "shares", type: "Uint256" }],
      state_mutability: "external",
    },
    {
      name: "withdraw",
      type: "function",
      inputs: [
        { name: "assets", type: "Uint256" },
        { name: "receiver", type: "felt" },
        { name: "owner", type: "felt" },
      ],
      outputs: [{ name: "shares", type: "Uint256" }],
      state_mutability: "external",
    },
    {
      name: "total_assets",
      type: "function",
      inputs: [],
      outputs: [{ name: "total_assets", type: "Uint256" }],
      state_mutability: "view",
    },
    {
      name: "convert_to_shares",
      type: "function",
      inputs: [{ name: "assets", type: "Uint256" }],
      outputs: [{ name: "shares", type: "Uint256" }],
      state_mutability: "view",
    },
    {
      name: "convert_to_assets",
      type: "function",
      inputs: [{ name: "shares", type: "Uint256" }],
      outputs: [{ name: "assets", type: "Uint256" }],
      state_mutability: "view",
    },
  ],

  oracle: [
    {
      name: "get_price",
      type: "function",
      inputs: [{ name: "collateral_type", type: "felt" }],
      outputs: [
        { name: "price", type: "Uint256" },
        { name: "decimals", type: "felt" },
        { name: "last_updated", type: "felt" },
      ],
      state_mutability: "view",
    },
  ],
} as const;

export interface MoonightContracts {
  addresses: typeof CONTRACT_ADDRESSES;
  abis: typeof ABIS;
  isMainnet: boolean;
}

/**
 * Hook providing Moonight Protocol contract addresses and ABIs.
 * Automatically selects addresses based on NEXT_PUBLIC_STARKNET_NETWORK.
 */
export function useMoonightContracts(): MoonightContracts {
  return useMemo(
    () => ({
      addresses: CONTRACT_ADDRESSES,
      abis: ABIS,
      isMainnet: process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet",
    }),
    []
  );
}

export { CONTRACT_ADDRESSES, ABIS };
