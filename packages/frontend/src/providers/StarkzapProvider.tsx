"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Wallet } from "starkzap";
import { starkzapSdk } from "@/lib/starkzap";

interface StarkzapContextValue {
  /** The connected starkzap wallet, if any */
  wallet: Wallet | null;
  /** Whether a starkzap connection is in progress */
  connecting: boolean;
  /** Connection error message */
  error: string;
  /** Connect via Cartridge Controller (social login: Google, Twitter, passkeys) */
  connectSocial: () => Promise<void>;
  /** Disconnect the starkzap wallet */
  disconnect: () => Promise<void>;
  /** The connected address (hex string) */
  address: string | null;
}

const StarkzapContext = createContext<StarkzapContextValue>({
  wallet: null,
  connecting: false,
  error: "",
  connectSocial: async () => {},
  disconnect: async () => {},
  address: null,
});

export function useStarkzap() {
  return useContext(StarkzapContext);
}

export default function StarkzapProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState<string | null>(null);

  const connectSocial = useCallback(async () => {
    setConnecting(true);
    setError("");
    try {
      const cartridgeWallet = await starkzapSdk.connectCartridge({
        feeMode: process.env.NEXT_PUBLIC_STARKZAP_GASLESS === "true"
          ? "sponsored"
          : "user_pays",
      });
      // connectCartridge returns CartridgeWalletInterface which extends WalletInterface
      // We need to get the address from the account
      const account = cartridgeWallet.getAccount();
      setAddress(account.address);
      // CartridgeWalletInterface is compatible with WalletInterface
      setWallet(cartridgeWallet as unknown as Wallet);
    } catch (e: any) {
      console.error("Starkzap social login failed:", e);
      setError(e?.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    if (wallet) {
      try {
        await wallet.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }
    setWallet(null);
    setAddress(null);
    setError("");
  }, [wallet]);

  return (
    <StarkzapContext.Provider
      value={{
        wallet,
        connecting,
        error,
        connectSocial,
        disconnect: disconnectWallet,
        address,
      }}
    >
      {children}
    </StarkzapContext.Provider>
  );
}
