"use client";

import { useState, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import {
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  PlusCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { Contract, cairo } from "starknet";

const MOCK_WBTC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_WBTC || "";
const MOONUSD_ADDRESS = process.env.NEXT_PUBLIC_MOONUSD || "";
const EXPLORER_BASE = "https://sepolia.voyager.online";

const MINT_AMOUNTS = [
  { label: "0.1 WBTC", sats: "10000000" },
  { label: "0.5 WBTC", sats: "50000000" },
  { label: "1 WBTC", sats: "100000000" },
  { label: "5 WBTC", sats: "500000000" },
];

const MOCK_WBTC_ABI = [
  {
    type: "interface",
    name: "mock_wbtc::mock_wbtc::IMockWBTC",
    items: [
      {
        type: "function",
        name: "mint_to",
        inputs: [
          { name: "to", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "impl",
    name: "MockWBTCImpl",
    interface_name: "mock_wbtc::mock_wbtc::IMockWBTC",
  },
] as const;

export default function FaucetPage() {
  const { address, account, isConnected } = useAccount();
  const [selectedAmount, setSelectedAmount] = useState(MINT_AMOUNTS[2]); // default 1 WBTC
  const [txHash, setTxHash] = useState("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const handleMint = useCallback(async () => {
    if (!address || !account || !MOCK_WBTC_ADDRESS) return;
    setMinting(true);
    setError("");
    setTxHash("");

    try {
      const wbtc = new Contract({ abi: MOCK_WBTC_ABI, address: MOCK_WBTC_ADDRESS, providerOrAccount: account });
      const call = wbtc.populate("mint_to", {
        to: address,
        amount: cairo.uint256(BigInt(selectedAmount.sats)),
      });
      const result = await account.execute(call);
      setTxHash(result.transaction_hash);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("User abort") || msg.includes("rejected")) {
        setError("Transaction rejected by wallet.");
      } else {
        setError("Mint transaction failed. Please try again.");
      }
    } finally {
      setMinting(false);
    }
  }, [address, account, selectedAmount]);

  const handleAddToWallet = useCallback(async () => {
    if (!MOCK_WBTC_ADDRESS) return;
    try {
      const walletApi = (window as any).starknet;
      if (walletApi?.request) {
        await walletApi.request({
          type: "wallet_watchAsset",
          params: {
            type: "ERC20",
            options: {
              address: MOCK_WBTC_ADDRESS,
              symbol: "WBTC",
              decimals: 8,
              name: "Wrapped BTC",
            },
          },
        });
      }
    } catch {
      // Fallback: copy address
      copyToClipboard(MOCK_WBTC_ADDRESS, "wbtc");
    }
  }, []);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (!MOCK_WBTC_ADDRESS) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-12">
          <BeakerIcon className="w-8 h-8 text-text-2 mx-auto mb-4" />
          <h2 className="text-lg font-display font-semibold text-text-0 mb-2">Faucet Not Available</h2>
          <p className="text-sm text-text-2">
            MockWBTC has not been deployed yet. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-10" data-animate="0">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl sm:text-2xl font-display font-semibold text-text-0">
            Testnet Faucet
          </h1>
          <span className="text-[10px] font-display uppercase tracking-wider text-accent border border-accent/20 px-2 py-0.5">
            Sepolia
          </span>
        </div>
        <p className="text-sm text-text-2">
          Mint test WBTC to use as collateral in the Moonight protocol
        </p>
      </div>

      {/* Token Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10 pb-8 border-b border-border/30" data-animate="1">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">Test WBTC</p>
          <p className="text-2xl font-mono font-semibold text-text-0 tracking-tight">Free Mint</p>
          <p className="text-xs text-text-2 mt-1">No limit on testnet</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">Network</p>
          <p className="text-2xl font-mono font-semibold text-text-0 tracking-tight">Sepolia</p>
          <p className="text-xs text-text-2 mt-1">Starknet testnet</p>
        </div>
      </div>

      {/* Mint Section */}
      <div className="mb-8" data-animate="2">
        <h3 className="text-sm font-display text-text-0 mb-4">
          Mint Test WBTC
        </h3>

        {/* Amount Selection — inline text buttons */}
        <div className="mb-5">
          <label className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-3 block">
            Select Amount
          </label>
          <div className="flex items-center gap-1 border-b border-border/30">
            {MINT_AMOUNTS.map((amt) => (
              <button
                key={amt.label}
                onClick={() => setSelectedAmount(amt)}
                className={`px-4 py-2.5 text-sm font-mono border-b-2 -mb-px transition-all ${
                  selectedAmount.label === amt.label
                    ? "text-accent border-accent"
                    : "text-text-2 border-transparent hover:text-text-1"
                }`}
              >
                {amt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mint Button */}
        <button
          onClick={handleMint}
          disabled={!isConnected || minting}
          className="btn-primary w-full text-sm py-3"
        >
          {!isConnected
            ? "Connect Wallet First"
            : minting
            ? "Confirming in Wallet..."
            : `Mint ${selectedAmount.label} to My Wallet`}
        </button>

        {/* Success */}
        {txHash && (
          <div className="mt-4 p-4 border-l-2 border-success bg-success/5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircleIcon className="w-4 h-4 text-success" />
              <p className="text-sm font-display text-success">
                {selectedAmount.label} minted successfully!
              </p>
            </div>
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
            >
              View on Voyager
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 border-l-2 border-danger bg-danger/5">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-danger flex-shrink-0" />
              <p className="text-xs text-danger/80">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Token to Wallet */}
      <div className="border-t border-border/30 pt-8 mb-8" data-animate="3">
        <h3 className="text-sm font-display text-text-0 mb-3">
          Add Token to Your Wallet
        </h3>
        <p className="text-xs text-text-2 mb-4 leading-relaxed">
          After minting, add WBTC to your wallet so it shows up in your token
          list.
        </p>

        <button
          onClick={handleAddToWallet}
          className="btn-secondary text-sm mb-5 flex items-center gap-2"
        >
          <PlusCircleIcon className="w-3.5 h-3.5" />
          Add WBTC to Wallet
        </button>

        <div className="space-y-4">
          {/* WBTC Address */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-1 block">
              WBTC Contract Address
            </label>
            <div className="flex items-center gap-2 py-2 border-b border-border/30">
              <code className="flex-1 text-xs text-text-1 font-mono break-all">
                {MOCK_WBTC_ADDRESS}
              </code>
              <button
                onClick={() => copyToClipboard(MOCK_WBTC_ADDRESS, "wbtc")}
                className="text-text-2 hover:text-text-0 transition-colors flex-shrink-0"
              >
                {copied === "wbtc" ? (
                  <CheckCircleIcon className="w-3.5 h-3.5 text-success" />
                ) : (
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* moonUSD Address */}
          {MOONUSD_ADDRESS && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-1 block">
                moonUSD Contract Address
              </label>
              <div className="flex items-center gap-2 py-2 border-b border-border/30">
                <code className="flex-1 text-xs text-text-1 font-mono break-all">
                  {MOONUSD_ADDRESS}
                </code>
                <button
                  onClick={() => copyToClipboard(MOONUSD_ADDRESS, "moonusd")}
                  className="text-text-2 hover:text-text-0 transition-colors flex-shrink-0"
                >
                  {copied === "moonusd" ? (
                    <CheckCircleIcon className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Instructions */}
      <div className="border-t border-border/30 pt-8" data-animate="4">
        <div className="flex items-start gap-4">
          <InformationCircleIcon className="w-4 h-4 text-text-2 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-display text-text-0 mb-2">
              How to Add Tokens Manually
            </h3>
            <div className="space-y-1.5 text-xs text-text-2 leading-relaxed">
              <p>
                <span className="text-text-1 font-mono">1.</span> Open your Starknet
                wallet (Ready Wallet, Braavos, etc.)
              </p>
              <p>
                <span className="text-text-1 font-mono">2.</span> Go to{" "}
                <span className="text-text-1">Assets</span> or{" "}
                <span className="text-text-1">Tokens</span> tab
              </p>
              <p>
                <span className="text-text-1 font-mono">3.</span> Click{" "}
                <span className="text-text-1">&quot;Add Token&quot;</span>{" "}
                or the <span className="text-text-1">+</span> button
              </p>
              <p>
                <span className="text-text-1 font-mono">4.</span> Paste the contract
                address from above and confirm
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
