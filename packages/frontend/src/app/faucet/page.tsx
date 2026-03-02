"use client";

import { useState, useCallback } from "react";
import { useAccount, useContract, useSendTransaction } from "@starknet-react/core";
import {
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  PlusCircleIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import StatsCard from "@/components/StatsCard";
import { CallData, uint256 } from "starknet";

const MOCK_WBTC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_WBTC || "";
const MOONUSD_ADDRESS = process.env.NEXT_PUBLIC_MOONUSD || "";
const EXPLORER_BASE = "https://sepolia.voyager.online";

const MINT_AMOUNTS = [
  { label: "0.1 WBTC", sats: "10000000000000000" },
  { label: "0.5 WBTC", sats: "50000000000000000" },
  { label: "1 WBTC", sats: "100000000000000000" },
  { label: "5 WBTC", sats: "500000000000000000" },
];

const MOCK_WBTC_ABI = [
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
] as const;

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const [selectedAmount, setSelectedAmount] = useState(MINT_AMOUNTS[2]); // default 1 WBTC
  const [txHash, setTxHash] = useState("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const { sendAsync } = useSendTransaction({});

  const handleMint = useCallback(async () => {
    if (!address || !MOCK_WBTC_ADDRESS) return;
    setMinting(true);
    setError("");
    setTxHash("");

    try {
      const amount = uint256.bnToUint256(BigInt(selectedAmount.sats));
      const result = await sendAsync([
        {
          contractAddress: MOCK_WBTC_ADDRESS,
          entrypoint: "mint_to",
          calldata: CallData.compile([address, amount]),
        },
      ]);
      setTxHash(result.transaction_hash);
    } catch (e: any) {
      setError(e?.message?.slice(0, 200) || "Transaction failed");
    } finally {
      setMinting(false);
    }
  }, [address, selectedAmount, sendAsync]);

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
              decimals: 18,
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  if (!MOCK_WBTC_ADDRESS) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card text-center py-12">
          <BeakerIcon className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-dark-100 mb-2">Faucet Not Available</h2>
          <p className="text-sm text-dark-400">
            MockWBTC has not been deployed yet. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-dark-50">
            Testnet Faucet
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/20 text-[10px] font-medium text-primary-400 uppercase tracking-wider">
            Sepolia
          </span>
        </div>
        <p className="text-dark-400">
          Mint test WBTC to use as collateral in the Moonight protocol
        </p>
      </div>

      {/* Token Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatsCard
          title="Test WBTC"
          value="Free Mint"
          subtitle="No limit on testnet"
          icon={<BeakerIcon className="w-5 h-5 text-accent-400" />}
          accentColor="accent"
        />
        <StatsCard
          title="Network"
          value="Sepolia"
          subtitle="Starknet testnet"
          icon={<WalletIcon className="w-5 h-5 text-primary-400" />}
          accentColor="primary"
        />
      </div>

      {/* Mint Card */}
      <div className="card mb-6">
        <h3 className="text-base font-semibold text-dark-100 mb-4">
          Mint Test WBTC
        </h3>

        {/* Amount Selection */}
        <div className="mb-5">
          <label className="text-xs text-dark-400 mb-2 block">Select Amount</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MINT_AMOUNTS.map((amt) => (
              <button
                key={amt.label}
                onClick={() => setSelectedAmount(amt)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  selectedAmount.label === amt.label
                    ? "bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/20"
                    : "bg-dark-900/30 border-dark-700/30 hover:border-dark-600"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    selectedAmount.label === amt.label
                      ? "text-primary-400"
                      : "text-dark-300"
                  }`}
                >
                  {amt.label}
                </p>
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
          <div className="mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircleIcon className="w-5 h-5 text-green-400" />
              <p className="text-sm font-semibold text-green-400">
                {selectedAmount.label} minted successfully!
              </p>
            </div>
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
            >
              View on Voyager
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Token to Wallet */}
      <div className="card mb-6">
        <h3 className="text-base font-semibold text-dark-100 mb-3">
          Add Token to Your Wallet
        </h3>
        <p className="text-sm text-dark-400 mb-4 leading-relaxed">
          After minting, add WBTC to your wallet so it shows up in your token
          list. Click the button below or manually add the token contract
          address.
        </p>

        <button
          onClick={handleAddToWallet}
          className="btn-secondary text-sm mb-4 flex items-center gap-2"
        >
          <PlusCircleIcon className="w-4 h-4" />
          Add WBTC to Wallet
        </button>

        <div className="space-y-3">
          {/* WBTC Address */}
          <div>
            <label className="text-xs text-dark-500 mb-1 block">WBTC Contract Address</label>
            <div className="flex items-center gap-2 bg-dark-900/50 rounded-xl border border-dark-600/50 p-3">
              <code className="flex-1 text-xs text-dark-300 font-mono break-all">
                {MOCK_WBTC_ADDRESS}
              </code>
              <button
                onClick={() => copyToClipboard(MOCK_WBTC_ADDRESS, "wbtc")}
                className="text-dark-400 hover:text-dark-200 transition-colors flex-shrink-0"
              >
                {copied === "wbtc" ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-400" />
                ) : (
                  <ClipboardDocumentIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* moonUSD Address */}
          {MOONUSD_ADDRESS && (
            <div>
              <label className="text-xs text-dark-500 mb-1 block">moonUSD Contract Address</label>
              <div className="flex items-center gap-2 bg-dark-900/50 rounded-xl border border-dark-600/50 p-3">
                <code className="flex-1 text-xs text-dark-300 font-mono break-all">
                  {MOONUSD_ADDRESS}
                </code>
                <button
                  onClick={() => copyToClipboard(MOONUSD_ADDRESS, "moonusd")}
                  className="text-dark-400 hover:text-dark-200 transition-colors flex-shrink-0"
                >
                  {copied === "moonusd" ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-400" />
                  ) : (
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Instructions */}
      <div className="p-6 rounded-2xl bg-dark-800/40 border border-dark-700/30">
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
            <WalletIcon className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-dark-200 mb-2">
              How to Add Tokens Manually
            </h3>
            <div className="space-y-2 text-sm text-dark-400 leading-relaxed">
              <p>
                <strong className="text-dark-300">1.</strong> Open your Starknet
                wallet (Ready Wallet, Braavos, etc.)
              </p>
              <p>
                <strong className="text-dark-300">2.</strong> Go to{" "}
                <strong className="text-dark-300">Assets</strong> or{" "}
                <strong className="text-dark-300">Tokens</strong> tab
              </p>
              <p>
                <strong className="text-dark-300">3.</strong> Click{" "}
                <strong className="text-dark-300">&quot;Add Token&quot;</strong>{" "}
                or the <strong className="text-dark-300">+</strong> button
              </p>
              <p>
                <strong className="text-dark-300">4.</strong> Paste the contract
                address from above and confirm
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
