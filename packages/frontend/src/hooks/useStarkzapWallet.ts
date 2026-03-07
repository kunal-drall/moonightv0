"use client";

import { useStarkzap } from "@/providers/StarkzapProvider";
import { useAccount } from "@starknet-react/core";
import type { AccountInterface } from "starknet";
import type { Wallet } from "starkzap";

export type WalletSource = "starkzap" | "starknet-react" | null;

/**
 * Unified wallet hook that returns the active connection from either
 * starknet-react (Braavos/Ready) or starkzap (social login).
 *
 * Due to starknet v8/v9 type incompatibility, starkzap wallet is
 * returned separately via `szWallet` rather than as `account`.
 * Use `source` to determine which path to take for transactions.
 */
export function useUnifiedWallet(): {
  address: string | undefined;
  /** starknet-react account (v8) — only set when source is "starknet-react" */
  account: AccountInterface | undefined;
  /** starkzap wallet (v9) — only set when source is "starkzap" */
  szWallet: Wallet | null;
  isConnected: boolean;
  source: WalletSource;
} {
  const starkzap = useStarkzap();
  const starknetReact = useAccount();

  // Starkzap takes priority when connected
  if (starkzap.wallet && starkzap.address) {
    return {
      address: starkzap.address,
      account: undefined,
      szWallet: starkzap.wallet,
      isConnected: true,
      source: "starkzap",
    };
  }

  if (starknetReact.isConnected && starknetReact.address) {
    return {
      address: starknetReact.address,
      account: starknetReact.account,
      szWallet: null,
      isConnected: true,
      source: "starknet-react",
    };
  }

  return {
    address: undefined,
    account: undefined,
    szWallet: null,
    isConnected: false,
    source: null,
  };
}
