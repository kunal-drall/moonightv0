"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import {
  ArrowRightIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface Vault {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  apy: string;
  apyRange?: string;
  tvl: string;
  deposited: string;
  capacity: string;
  capacityUsed: number;
  riskLevel: "Low" | "Medium" | "High";
  strategy: string[];
  features: string[];
  status: "Active" | "Coming Soon";
}

const vaults: Vault[] = [
  {
    id: "vault-a",
    name: "Vault A",
    subtitle: "Delta-Neutral Strategy",
    description:
      "Earn stable yield through a hedged BTC position. The protocol simultaneously holds spot BTC and opens a short perpetual position, capturing funding rate yield while neutralizing price exposure.",
    apy: "5-12%",
    apyRange: "Est. APY range",
    tvl: "--",
    deposited: "0.00 moonUSD",
    capacity: "--",
    capacityUsed: 0,
    riskLevel: "Low",
    strategy: [
      "Spot BTC + Short Perp",
      "Funding rate harvesting",
      "Auto-compounding",
    ],
    features: [
      "Delta-neutral exposure",
      "Auto-rebalancing",
      "No impermanent loss",
      "Weekly harvesting",
    ],
    status: "Coming Soon",
  },
  {
    id: "vault-b",
    name: "Vault B",
    subtitle: "Leveraged BTC Accumulation",
    description:
      "Amplify your BTC exposure through recursive CDP loops. Deposit BTC, mint moonUSD, swap back to BTC, and repeat — achieving up to 3x leveraged long exposure with automated deleveraging protection.",
    apy: "Variable",
    apyRange: "BTC upside x3",
    tvl: "--",
    deposited: "0.00 BTC",
    capacity: "--",
    capacityUsed: 0,
    riskLevel: "High",
    strategy: [
      "Recursive CDP loops",
      "Up to 3x leverage",
      "Auto-deleverage protection",
    ],
    features: [
      "Amplified BTC gains",
      "Adjustable leverage",
      "Keeper-based safety",
      "One-click unwind",
    ],
    status: "Coming Soon",
  },
  {
    id: "vault-c",
    name: "Vault C",
    subtitle: "Yield Optimizer",
    description:
      "Maximize returns on your moonUSD through curated DeFi yield strategies. Allocates across lending protocols, liquidity pools, and structured products for optimized risk-adjusted returns.",
    apy: "8-25%",
    apyRange: "Est. APY range",
    tvl: "--",
    deposited: "0.00 moonUSD",
    capacity: "--",
    capacityUsed: 0,
    riskLevel: "Medium",
    strategy: [
      "Multi-protocol allocation",
      "Yield aggregation",
      "Smart rebalancing",
    ],
    features: [
      "Diversified strategies",
      "Auto-compounding",
      "Risk-managed allocation",
      "Withdrawal anytime",
    ],
    status: "Coming Soon",
  },
  {
    id: "vault-d",
    name: "Vault D",
    subtitle: "Covered Call + PT/YT",
    description:
      "Earn premium yield by selling covered calls on your BTC. Deposit BTC, receive Principal Tokens (PT) and Yield Tokens (YT). Trade yield separately from principal — Pendle-style tokenization on Starknet.",
    apy: "12-30%",
    apyRange: "Est. APY range",
    tvl: "--",
    deposited: "0.00 BTC",
    capacity: "--",
    capacityUsed: 0,
    riskLevel: "Medium",
    strategy: [
      "OTM covered calls",
      "PT/YT tokenization",
      "Weekly epoch settlement",
    ],
    features: [
      "Premium income stream",
      "Tradeable yield tokens",
      "Principal protected (OTM)",
      "Weekly epochs",
    ],
    status: "Coming Soon",
  },
];

const riskDotColor = {
  Low: "bg-success",
  Medium: "bg-accent",
  High: "bg-danger",
};

const riskTextColor = {
  Low: "text-success",
  Medium: "text-accent",
  High: "text-danger",
};

export default function VaultsPage() {
  const { isConnected } = useAccount();
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-10" data-animate="0">
        <h1 className="text-xl sm:text-2xl font-display font-semibold text-text-0 mb-1">
          Vaults
        </h1>
        <p className="text-sm text-text-2">
          Deposit moonUSD into yield-generating vaults with different risk
          profiles
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12 pb-10 border-b border-border/30" data-animate="1">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">
            Total Vault TVL
          </p>
          <p className="text-2xl sm:text-3xl font-mono font-semibold text-text-0 tracking-tight">
            --
          </p>
          <p className="text-xs text-text-2 mt-1">Vaults launching soon</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">
            Vault Types
          </p>
          <p className="text-2xl sm:text-3xl font-mono font-semibold text-text-0 tracking-tight">
            4
          </p>
          <p className="text-xs text-text-2 mt-1">Delta-neutral, Leverage, Yield, Covered Call</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">
            Your Deposits
          </p>
          <p className="text-2xl sm:text-3xl font-mono font-semibold text-text-0 tracking-tight">
            $0.00
          </p>
          <p className="text-xs text-text-2 mt-1">Connect wallet to view</p>
        </div>
      </div>

      {/* Vault Rows */}
      <div>
        {vaults.map((vault, i) => (
          <div
            key={vault.id}
            className="border-b border-border/20 py-8 first:pt-0 last:border-b-0"
            data-animate={String(i + 2)}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
              {/* Vault Info - Left */}
              <div className="lg:col-span-7">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-display font-semibold text-text-0">
                    {vault.name}
                  </h2>
                  <span className="text-xs font-display text-text-2">
                    {vault.subtitle}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${riskDotColor[vault.riskLevel]}`} />
                    <span className={`text-[10px] font-display uppercase tracking-wider ${riskTextColor[vault.riskLevel]}`}>
                      {vault.riskLevel} Risk
                    </span>
                  </div>
                  {vault.status === "Coming Soon" && (
                    <span className="text-[10px] font-display uppercase tracking-wider text-text-2">
                      Coming Soon
                    </span>
                  )}
                </div>

                <p className="text-sm text-text-2 leading-relaxed mb-4 max-w-2xl">
                  {vault.description}
                </p>

                {/* Strategy — comma-separated */}
                <p className="text-xs text-text-2 mb-3">
                  <span className="text-text-1">Strategy:</span>{" "}
                  {vault.strategy.join(" · ")}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {vault.features.map((feature) => (
                    <span key={feature} className="text-[11px] text-text-2">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Vault Stats + Deposit - Right */}
              <div className="lg:col-span-5 lg:border-l lg:border-border/20 lg:pl-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-1">APY</p>
                    <p className="text-2xl font-mono font-semibold text-success">
                      {vault.apy}
                    </p>
                    <p className="text-[10px] font-mono text-text-2">{vault.apyRange}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-1">TVL</p>
                    <p className="text-2xl font-mono font-semibold text-text-0">
                      {vault.tvl}
                    </p>
                    <p className="text-[10px] font-mono text-text-2">
                      of {vault.capacity}
                    </p>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-text-2 font-display uppercase tracking-wider">
                      Capacity
                    </span>
                    <span className="text-[10px] font-mono text-text-2">
                      {vault.capacityUsed}%
                    </span>
                  </div>
                  <div className="w-full h-[2px] bg-border/30 overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-500"
                      style={{ width: `${vault.capacityUsed}%` }}
                    />
                  </div>
                </div>

                {/* Deposit/Withdraw */}
                {selectedVault === vault.id ? (
                  <div className="animate-fade-up">
                    <div className="flex items-center gap-1 border-b border-border/30 mb-4">
                      <button
                        onClick={() => setActiveTab("deposit")}
                        className={`px-3 py-2 text-xs font-display uppercase tracking-wider border-b-2 -mb-px transition-all ${
                          activeTab === "deposit"
                            ? "text-accent border-accent"
                            : "text-text-2 border-transparent hover:text-text-1"
                        }`}
                      >
                        Deposit
                      </button>
                      <button
                        onClick={() => setActiveTab("withdraw")}
                        className={`px-3 py-2 text-xs font-display uppercase tracking-wider border-b-2 -mb-px transition-all ${
                          activeTab === "withdraw"
                            ? "text-accent border-accent"
                            : "text-text-2 border-transparent hover:text-text-1"
                        }`}
                      >
                        Withdraw
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center border-b border-border focus-within:border-accent transition-colors">
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 bg-transparent py-2.5 text-base font-mono text-text-0 placeholder:text-text-2/30 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-text-2 pl-3">
                          moonUSD
                        </span>
                      </div>

                      <button
                        disabled={!isConnected || !depositAmount}
                        className="btn-primary w-full text-sm py-2.5"
                      >
                        {!isConnected
                          ? "Connect Wallet"
                          : activeTab === "deposit"
                            ? "Deposit moonUSD"
                            : "Withdraw moonUSD"}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedVault(null);
                          setDepositAmount("");
                        }}
                        className="w-full text-center text-xs text-text-2 hover:text-text-1 transition-colors py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-text-2 font-display uppercase tracking-wider">Your Deposit</p>
                        <p className="text-sm font-mono text-text-0">
                          {vault.deposited}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-text-2 font-display uppercase tracking-wider">Earned</p>
                        <p className="text-sm font-mono text-success">
                          $0.00
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => vault.status !== "Coming Soon" && setSelectedVault(vault.id)}
                      disabled={vault.status === "Coming Soon"}
                      className={`w-full text-sm py-2.5 ${vault.status === "Coming Soon" ? "btn-secondary opacity-50 cursor-not-allowed" : "btn-primary"}`}
                    >
                      {vault.status === "Coming Soon"
                        ? "Coming Soon"
                        : isConnected ? "Manage Position" : "Connect & Deposit"}
                      {vault.status !== "Coming Soon" && <ArrowRightIcon className="w-3.5 h-3.5 ml-2" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Section */}
      <div className="mt-12 border-t border-border/30 pt-10 space-y-6">
        <div className="flex items-start gap-4">
          <InformationCircleIcon className="w-4 h-4 text-text-2 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-display text-text-0 mb-1">
              How Vaults Work
            </h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Deposit your moonUSD into vaults to earn yield. Vault A uses a
              delta-neutral strategy (long spot BTC + short perp) to harvest
              funding rates with minimal price exposure. Vault C aggregates
              yield across multiple DeFi protocols for higher returns. All vault
              shares are tokenized as ERC-4626 tokens on Starknet.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <ExclamationTriangleIcon className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-display text-text-0 mb-1">
              Risk Disclosure
            </h3>
            <p className="text-xs text-text-2 leading-relaxed">
              All vaults carry risk including smart contract risk, strategy
              risk, and market risk. Past performance does not guarantee future
              results. APY figures are variable and subject to change. Only
              deposit what you can afford to lose. This protocol is currently on
              testnet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
