"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useState, useRef, useEffect } from "react";
import {
  WalletIcon,
  ChevronDownIcon,
  ArrowRightStartOnRectangleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isConnected && address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-600/50 hover:border-primary-500/30 transition-all duration-200"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-dark-100">
            {truncateAddress(address)}
          </span>
          <ChevronDownIcon className="w-4 h-4 text-dark-400" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-dark-800 border border-dark-600/50 shadow-xl shadow-black/20 overflow-hidden z-50 animate-fade-in">
            <div className="p-4 border-b border-dark-700/50">
              <p className="text-xs text-dark-500 mb-1">Connected Address</p>
              <p className="text-sm font-mono text-dark-200">
                {truncateAddress(address)}
              </p>
            </div>
            <div className="p-2">
              <button
                onClick={handleCopy}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-dark-700/50 transition-colors text-left"
              >
                {copied ? (
                  <CheckIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <ClipboardDocumentIcon className="w-4 h-4 text-dark-400" />
                )}
                <span className="text-sm text-dark-300">
                  {copied ? "Copied!" : "Copy Address"}
                </span>
              </button>
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-dark-700/50 transition-colors text-left"
              >
                <ArrowRightStartOnRectangleIcon className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">Disconnect</span>
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
        className="btn-primary text-sm"
      >
        <WalletIcon className="w-4 h-4 mr-2" />
        Connect Wallet
      </button>

      {showConnectors && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-dark-800 border border-dark-600/50 shadow-xl shadow-black/20 overflow-hidden z-50 animate-fade-in">
          <div className="p-4 border-b border-dark-700/50">
            <h3 className="text-sm font-semibold text-dark-100">
              Connect a Wallet
            </h3>
            <p className="text-xs text-dark-500 mt-1">
              Choose a wallet to connect to Moonight
            </p>
          </div>
          <div className="p-2">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => {
                  connect({ connector });
                  setShowConnectors(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-3 rounded-lg hover:bg-dark-700/50 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center border border-dark-600/50 group-hover:border-primary-500/30 transition-colors">
                  <WalletIcon className="w-5 h-5 text-dark-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-200 group-hover:text-dark-50 transition-colors">
                    {connector.name}
                  </p>
                  <p className="text-xs text-dark-500">
                    {connector.id === "argentX"
                      ? "Starknet wallet by Argent"
                      : connector.id === "braavos"
                        ? "Smart wallet for Starknet"
                        : "Starknet wallet"}
                  </p>
                </div>
              </button>
            ))}
            {connectors.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-dark-400">No wallets detected</p>
                <p className="text-xs text-dark-500 mt-1">
                  Install ArgentX or Braavos to continue
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
