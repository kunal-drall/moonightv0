"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import {
  ShieldCheckIcon,
  BoltIcon,
  ArrowRightIcon,
  ChartBarIcon,
  LockClosedIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckBadgeIcon,
  FireIcon,
} from "@heroicons/react/24/outline";
import StatsCard from "@/components/StatsCard";

interface Vault {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  apy: string;
  apyRange?: string;
  tvl: string;
  deposited: string;
  capacity: string;
  capacityUsed: number;
  riskLevel: "Low" | "Medium" | "High";
  strategy: string[];
  gradient: string;
  iconBg: string;
  accentColor: string;
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
    icon: <ShieldCheckIcon className="w-7 h-7" />,
    apy: "8.2%",
    apyRange: "5-12% APY",
    tvl: "$14.6M",
    deposited: "0.00 moonUSD",
    capacity: "$25M",
    capacityUsed: 58,
    riskLevel: "Low",
    strategy: [
      "Spot BTC + Short Perp",
      "Funding rate harvesting",
      "Auto-compounding",
    ],
    gradient: "from-accent-500 to-amber-600",
    iconBg: "bg-accent-500/10 border-accent-500/20",
    accentColor: "accent",
    features: [
      "Delta-neutral exposure",
      "Auto-rebalancing",
      "No impermanent loss",
      "Weekly harvesting",
    ],
    status: "Active",
  },
  {
    id: "vault-c",
    name: "Vault C",
    subtitle: "Yield Optimizer",
    description:
      "Maximize returns on your moonUSD through curated DeFi yield strategies. Allocates across lending protocols, liquidity pools, and structured products for optimized risk-adjusted returns.",
    icon: <BoltIcon className="w-7 h-7" />,
    apy: "14.7%",
    apyRange: "8-25% APY",
    tvl: "$10.2M",
    deposited: "0.00 moonUSD",
    capacity: "$20M",
    capacityUsed: 51,
    riskLevel: "Medium",
    strategy: [
      "Multi-protocol allocation",
      "Yield aggregation",
      "Smart rebalancing",
    ],
    gradient: "from-green-500 to-emerald-600",
    iconBg: "bg-green-500/10 border-green-500/20",
    accentColor: "green",
    features: [
      "Diversified strategies",
      "Auto-compounding",
      "Risk-managed allocation",
      "Withdrawal anytime",
    ],
    status: "Active",
  },
];

const riskColors = {
  Low: "text-green-400 bg-green-500/10 border-green-500/20",
  Medium: "text-accent-400 bg-accent-500/10 border-accent-500/20",
  High: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function VaultsPage() {
  const { isConnected } = useAccount();
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-dark-50 mb-2">
          Vaults
        </h1>
        <p className="text-dark-400">
          Deposit moonUSD into yield-generating vaults with different risk
          profiles
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatsCard
          title="Total Vault TVL"
          value="$24.8M"
          subtitle="Across all vaults"
          change={{ value: "+8.3%", positive: true }}
          icon={<ChartBarIcon className="w-5 h-5 text-primary-400" />}
          accentColor="primary"
        />
        <StatsCard
          title="Avg. APY"
          value="11.4%"
          subtitle="Weighted average"
          change={{ value: "+1.2%", positive: true }}
          icon={<FireIcon className="w-5 h-5 text-accent-400" />}
          accentColor="accent"
        />
        <StatsCard
          title="Your Deposits"
          value="$0.00"
          subtitle="Connect wallet to view"
          icon={<LockClosedIcon className="w-5 h-5 text-green-400" />}
          accentColor="green"
        />
      </div>

      {/* Vault Cards */}
      <div className="space-y-6">
        {vaults.map((vault) => (
          <div key={vault.id} className="card-hover relative overflow-hidden">
            {/* Top gradient bar */}
            <div
              className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${vault.gradient}`}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Vault Info - Left */}
              <div className="lg:col-span-7">
                <div className="flex items-start space-x-4 mb-4">
                  <div
                    className={`w-14 h-14 rounded-2xl ${vault.iconBg} border flex items-center justify-center flex-shrink-0`}
                  >
                    <div className="text-dark-300">{vault.icon}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-1">
                      <h2 className="text-xl font-bold text-dark-50">
                        {vault.name}
                      </h2>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${
                          riskColors[vault.riskLevel]
                        }`}
                      >
                        {vault.riskLevel} Risk
                      </span>
                      {vault.status === "Active" && (
                        <span className="inline-flex items-center space-x-1 text-xs text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-400 font-medium mb-2">
                      {vault.subtitle}
                    </p>
                    <p className="text-sm text-dark-500 leading-relaxed">
                      {vault.description}
                    </p>
                  </div>
                </div>

                {/* Strategy Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {vault.strategy.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-dark-700/50 border border-dark-600/30 text-xs text-dark-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Features List */}
                <div className="grid grid-cols-2 gap-2">
                  {vault.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center space-x-2 text-xs text-dark-400"
                    >
                      <CheckBadgeIcon className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vault Stats + Deposit - Right */}
              <div className="lg:col-span-5 lg:border-l lg:border-dark-700/50 lg:pl-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-dark-500 mb-1">APY</p>
                    <p className="text-2xl font-bold text-green-400">
                      {vault.apy}
                    </p>
                    <p className="text-xs text-dark-500">{vault.apyRange}</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-500 mb-1">TVL</p>
                    <p className="text-2xl font-bold text-dark-100">
                      {vault.tvl}
                    </p>
                    <p className="text-xs text-dark-500">
                      of {vault.capacity}
                    </p>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-dark-500">
                      Vault Capacity
                    </span>
                    <span className="text-xs text-dark-400 font-medium">
                      {vault.capacityUsed}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-dark-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${vault.gradient} transition-all duration-500`}
                      style={{ width: `${vault.capacityUsed}%` }}
                    />
                  </div>
                </div>

                {/* Deposit/Withdraw Tabs */}
                {selectedVault === vault.id ? (
                  <div className="animate-fade-in">
                    <div className="flex items-center space-x-1 p-1 bg-dark-900/50 rounded-xl mb-4">
                      <button
                        onClick={() => setActiveTab("deposit")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeTab === "deposit"
                            ? "bg-dark-700 text-dark-50"
                            : "text-dark-500 hover:text-dark-300"
                        }`}
                      >
                        Deposit
                      </button>
                      <button
                        onClick={() => setActiveTab("withdraw")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeTab === "withdraw"
                            ? "bg-dark-700 text-dark-50"
                            : "text-dark-500 hover:text-dark-300"
                        }`}
                      >
                        Withdraw
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center bg-dark-900/50 rounded-xl border border-dark-600/50 focus-within:border-primary-500/50 transition-all">
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 bg-transparent px-4 py-3 text-base font-medium text-dark-50 placeholder:text-dark-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-sm text-dark-400 px-4">
                          moonUSD
                        </span>
                      </div>

                      <button
                        disabled={!isConnected || !depositAmount}
                        className="btn-primary w-full text-sm py-3"
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
                        className="w-full text-center text-xs text-dark-500 hover:text-dark-300 transition-colors py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-dark-900/30 border border-dark-700/30">
                      <div>
                        <p className="text-xs text-dark-500">Your Deposit</p>
                        <p className="text-sm font-medium text-dark-200">
                          {vault.deposited}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-dark-500">Earned</p>
                        <p className="text-sm font-medium text-green-400">
                          $0.00
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedVault(vault.id)}
                      className="btn-primary w-full text-sm py-3"
                    >
                      {isConnected ? "Manage Position" : "Connect & Deposit"}
                      <ArrowRightIcon className="w-3.5 h-3.5 ml-2" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="mt-10 p-6 rounded-2xl bg-dark-800/40 border border-dark-700/30">
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
            <InformationCircleIcon className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-dark-200 mb-1">
              How Vaults Work
            </h3>
            <p className="text-sm text-dark-400 leading-relaxed">
              Deposit your moonUSD into vaults to earn yield. Vault A uses a
              delta-neutral strategy (long spot BTC + short perp) to harvest
              funding rates with minimal price exposure. Vault C aggregates
              yield across multiple DeFi protocols for higher returns. All vault
              shares are tokenized as ERC-4626 tokens on Starknet.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start space-x-4">
          <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center flex-shrink-0">
            <ExclamationTriangleIcon className="w-5 h-5 text-accent-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-dark-200 mb-1">
              Risk Disclosure
            </h3>
            <p className="text-sm text-dark-400 leading-relaxed">
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
