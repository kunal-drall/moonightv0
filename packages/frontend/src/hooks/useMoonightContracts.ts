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
  mockWbtc: process.env.NEXT_PUBLIC_MOCK_WBTC || "0x0",
} as const;

/**
 * Cairo 2 ABIs extracted from compiled contracts.
 * Uses interface+impl pattern required by starknet.js v8.
 */
const ABIS = {
  erc20: [
    {
      type: "struct" as const,
      name: "core::integer::u256",
      members: [
        { name: "low", type: "core::integer::u128" },
        { name: "high", type: "core::integer::u128" },
      ],
    },
    {
      type: "interface" as const,
      name: "openzeppelin_token::erc20::interface::IERC20",
      items: [
        {
          type: "function" as const,
          name: "total_supply",
          inputs: [],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "balance_of",
          inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "allowance",
          inputs: [
            { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
            { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
          ],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "transfer",
          inputs: [
            { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [{ type: "core::bool" }],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "transfer_from",
          inputs: [
            { name: "sender", type: "core::starknet::contract_address::ContractAddress" },
            { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [{ type: "core::bool" }],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "approve",
          inputs: [
            { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [{ type: "core::bool" }],
          state_mutability: "external" as const,
        },
      ],
    },
    {
      type: "impl" as const,
      name: "ERC20Impl",
      interface_name: "openzeppelin_token::erc20::interface::IERC20",
    },
  ],

  cdpManager: [
    {
      type: "struct" as const,
      name: "core::integer::u256",
      members: [
        { name: "low", type: "core::integer::u128" },
        { name: "high", type: "core::integer::u128" },
      ],
    },
    {
      type: "struct" as const,
      name: "moonight::interfaces::i_cdp_manager::PositionData",
      members: [
        { name: "collateral_type", type: "core::felt252" },
        { name: "collateral_amount", type: "core::integer::u256" },
        { name: "debt", type: "core::integer::u256" },
        { name: "interest_rate", type: "core::integer::u256" },
        { name: "last_update", type: "core::integer::u64" },
        { name: "created_at", type: "core::integer::u64" },
      ],
    },
    {
      type: "interface" as const,
      name: "moonight::interfaces::i_cdp_manager::ICDPManager",
      items: [
        {
          type: "function" as const,
          name: "open_position",
          inputs: [
            { name: "collateral_type", type: "core::felt252" },
            { name: "collateral_amount", type: "core::integer::u256" },
            { name: "mint_amount", type: "core::integer::u256" },
            { name: "interest_rate", type: "core::integer::u256" },
          ],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "close_position",
          inputs: [{ name: "position_id", type: "core::integer::u256" }],
          outputs: [],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "deposit_collateral",
          inputs: [
            { name: "position_id", type: "core::integer::u256" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "withdraw_collateral",
          inputs: [
            { name: "position_id", type: "core::integer::u256" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "mint_more",
          inputs: [
            { name: "position_id", type: "core::integer::u256" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "repay",
          inputs: [
            { name: "position_id", type: "core::integer::u256" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "set_rate",
          inputs: [
            { name: "position_id", type: "core::integer::u256" },
            { name: "new_rate", type: "core::integer::u256" },
          ],
          outputs: [],
          state_mutability: "external" as const,
        },
        {
          type: "function" as const,
          name: "get_position",
          inputs: [{ name: "position_id", type: "core::integer::u256" }],
          outputs: [{ type: "moonight::interfaces::i_cdp_manager::PositionData" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "get_health_factor",
          inputs: [{ name: "position_id", type: "core::integer::u256" }],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "get_current_debt",
          inputs: [{ name: "position_id", type: "core::integer::u256" }],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "get_market_average_rate",
          inputs: [],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "get_borrow_fee",
          inputs: [{ name: "mint_amount", type: "core::integer::u256" }],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "get_total_debt",
          inputs: [],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "get_active_positions",
          inputs: [],
          outputs: [{ type: "core::integer::u256" }],
          state_mutability: "view" as const,
        },
      ],
    },
    {
      type: "impl" as const,
      name: "CDPManagerImpl",
      interface_name: "moonight::interfaces::i_cdp_manager::ICDPManager",
    },
  ],

  oracle: [
    {
      type: "struct" as const,
      name: "core::integer::u256",
      members: [
        { name: "low", type: "core::integer::u128" },
        { name: "high", type: "core::integer::u128" },
      ],
    },
    {
      type: "interface" as const,
      name: "moonight::interfaces::i_price_oracle::IPriceOracle",
      items: [
        {
          type: "function" as const,
          name: "get_price",
          inputs: [{ name: "collateral_type", type: "core::felt252" }],
          outputs: [{ type: "(core::integer::u256, core::integer::u8)" }],
          state_mutability: "view" as const,
        },
        {
          type: "function" as const,
          name: "get_price_twap",
          inputs: [{ name: "collateral_type", type: "core::felt252" }],
          outputs: [{ type: "(core::integer::u256, core::integer::u8)" }],
          state_mutability: "view" as const,
        },
      ],
    },
    {
      type: "impl" as const,
      name: "PriceOracleImpl",
      interface_name: "moonight::interfaces::i_price_oracle::IPriceOracle",
    },
  ],

  mockWbtc: [
    {
      type: "struct" as const,
      name: "core::integer::u256",
      members: [
        { name: "low", type: "core::integer::u128" },
        { name: "high", type: "core::integer::u128" },
      ],
    },
    {
      type: "interface" as const,
      name: "moonight::token::mock_wbtc::IMockWBTC",
      items: [
        {
          type: "function" as const,
          name: "mint_to",
          inputs: [
            { name: "to", type: "core::starknet::contract_address::ContractAddress" },
            { name: "amount", type: "core::integer::u256" },
          ],
          outputs: [],
          state_mutability: "external" as const,
        },
      ],
    },
    {
      type: "impl" as const,
      name: "MockWBTCImpl",
      interface_name: "moonight::token::mock_wbtc::IMockWBTC",
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
