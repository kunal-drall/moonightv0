"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  WalletIcon,
  ArrowRightStartOnRectangleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const WALLET_META: Record<string, { label: string }> = {
  ready: { label: "Ready Wallet for Starknet" },
  argentX: { label: "Ready Wallet for Starknet" },
  braavos: { label: "Smart wallet for Starknet" },
  keplr: { label: "Multi-chain wallet" },
  okxwallet: { label: "OKX Web3 wallet" },
  bitget: { label: "Bitget Web3 wallet" },
};

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setShowConnectors(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard unavailable */
      }
    }
  };

  if (isConnected && address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 border border-border/50 hover:border-border transition-all duration-200"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
          <span className="text-xs font-mono text-text-1">
            {truncateAddress(address)}
          </span>
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-60 bg-surface-1 border border-border shadow-xl shadow-black/30 overflow-hidden z-50 animate-fade-up">
            <div className="p-4 border-b border-border/50">
              <p className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-1">Connected</p>
              <p className="text-xs font-mono text-text-1">
                {truncateAddress(address)}
              </p>
            </div>
            <div className="p-1.5">
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors text-left"
              >
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5 text-success" />
                ) : (
                  <ClipboardDocumentIcon className="w-3.5 h-3.5 text-text-2" />
                )}
                <span className="text-xs text-text-1">
                  {copied ? "Copied" : "Copy Address"}
                </span>
              </button>
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors text-left"
              >
                <ArrowRightStartOnRectangleIcon className="w-3.5 h-3.5 text-danger" />
                <span className="text-xs text-danger">Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowConnectors(!showConnectors)}
        className="btn-primary text-xs py-2 px-4"
      >
        <WalletIcon className="w-3.5 h-3.5 mr-1.5" />
        Connect
      </button>

      {showConnectors && (
        <div className="absolute right-0 mt-2 w-68 bg-surface-1 border border-border shadow-xl shadow-black/30 overflow-hidden z-50 animate-fade-up">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-xs font-display uppercase tracking-wider text-text-0">
              Connect Wallet
            </h3>
            <p className="text-[10px] text-text-2 mt-1">
              Choose a wallet to connect
            </p>
          </div>
          <div className="p-1.5 max-h-80 overflow-y-auto">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={async () => {
                  try {
                    connect({ connector });
                  } catch (e) {
                    console.error("Wallet connection failed:", e);
                  }
                  setShowConnectors(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors text-left group"
              >
                <div className="w-9 h-9 bg-surface-2 border border-border/50 flex items-center justify-center group-hover:border-border transition-colors overflow-hidden shrink-0">
                  {connector.icon ? (
                    <Image
                      src={
                        typeof connector.icon === "string"
                          ? connector.icon
                          : connector.icon.dark ?? connector.icon.light
                      }
                      alt={connector.name}
                      width={24}
                      height={24}
                    />
                  ) : (
                    <WalletIcon className="w-4 h-4 text-text-2" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-display text-text-1 group-hover:text-text-0 transition-colors truncate">
                    {connector.name}
                  </p>
                  <p className="text-[10px] text-text-2 truncate">
                    {WALLET_META[connector.id]?.label ?? "Starknet wallet"}
                  </p>
                </div>
              </button>
            ))}
            {connectors.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-text-2">No wallets detected</p>
                <p className="text-[10px] text-text-2 mt-1">
                  Install Ready Wallet or Braavos
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
