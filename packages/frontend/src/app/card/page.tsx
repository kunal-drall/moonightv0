"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import {
  CreditCardIcon,
  BanknotesIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  LockClosedIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import StatsCard from "@/components/StatsCard";

const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";

type CardTab = "debit" | "credit";
type TopupSource = "wallet" | "vault-c";

interface Transaction {
  id: string;
  merchant: string;
  amount: string;
  date: string;
  status: "settled" | "pending" | "declined";
  category: string;
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    merchant: "Amazon Web Services",
    amount: "-$49.99",
    date: "Feb 28, 2025",
    status: "settled",
    category: "Technology",
  },
  {
    id: "2",
    merchant: "Uber Eats",
    amount: "-$32.50",
    date: "Feb 27, 2025",
    status: "settled",
    category: "Food & Dining",
  },
  {
    id: "3",
    merchant: "Spotify",
    amount: "-$9.99",
    date: "Feb 25, 2025",
    status: "settled",
    category: "Entertainment",
  },
  {
    id: "4",
    merchant: "Card Top-up",
    amount: "+$500.00",
    date: "Feb 24, 2025",
    status: "settled",
    category: "Top-up",
  },
  {
    id: "5",
    merchant: "Netflix",
    amount: "-$15.99",
    date: "Feb 23, 2025",
    status: "pending",
    category: "Entertainment",
  },
];

const statusStyles = {
  settled: "text-green-400 bg-green-500/10",
  pending: "text-accent-400 bg-accent-500/10",
  declined: "text-red-400 bg-red-500/10",
};

export default function CardPage() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<CardTab>("debit");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupSource, setTopupSource] = useState<TopupSource>("wallet");
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);
  const [autoTopupThreshold, setAutoTopupThreshold] = useState("50");
  const [autoTopupAmount, setAutoTopupAmount] = useState("200");
  const [showKYC, setShowKYC] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-dark-50 mb-2">
          Moonight Card
        </h1>
        <p className="text-dark-400">
          Spend your DeFi yield anywhere with virtual debit and credit cards
        </p>
      </div>

      {/* Card Type Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-dark-800/60 border border-dark-700/50 rounded-2xl mb-8 max-w-md">
        <button
          onClick={() => setActiveTab("debit")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === "debit"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
              : "text-dark-400 hover:text-dark-200"
          }`}
        >
          <CreditCardIcon className="w-4 h-4" />
          Debit Card
        </button>
        <button
          onClick={() => setActiveTab("credit")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === "credit"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
              : "text-dark-400 hover:text-dark-200"
          }`}
        >
          <SparklesIcon className="w-4 h-4" />
          Credit Card
        </button>
      </div>

      {activeTab === "debit" ? (
        <>
          {/* Debit Card Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatsCard
              title="Card Balance"
              value="$0.00"
              subtitle={isConnected ? "Available to spend" : "Connect wallet"}
              icon={<BanknotesIcon className="w-5 h-5 text-green-400" />}
              accentColor="green"
            />
            <StatsCard
              title="Monthly Spent"
              value="$0.00"
              subtitle="This month"
              icon={<CreditCardIcon className="w-5 h-5 text-primary-400" />}
              accentColor="primary"
            />
            <StatsCard
              title="Total Top-ups"
              value="$0.00"
              subtitle="Lifetime"
              icon={<ArrowPathIcon className="w-5 h-5 text-accent-400" />}
              accentColor="accent"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Virtual Card Visual + Actions */}
            <div className="lg:col-span-7 space-y-6">
              {/* Virtual Card */}
              <div className="card relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 via-dark-800/60 to-accent-500/10" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">M</span>
                      </div>
                      <span className="text-sm font-semibold text-dark-200">
                        Moonight
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-dark-400 font-medium">
                        Virtual Debit
                      </span>
                      <div className="w-8 h-5 rounded bg-gradient-to-r from-accent-400 to-accent-600" />
                    </div>
                  </div>

                  {isConnected ? (
                    <>
                      <p className="text-2xl font-mono tracking-[0.2em] text-dark-200 mb-6">
                        •••• •••• •••• 4832
                      </p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] uppercase text-dark-500 mb-0.5">
                            Cardholder
                          </p>
                          <p className="text-sm text-dark-300 font-medium">
                            MOONIGHT USER
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-dark-500 mb-0.5">
                            Expires
                          </p>
                          <p className="text-sm text-dark-300 font-medium">
                            12/27
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-dark-500 mb-0.5">
                            Balance
                          </p>
                          <p className="text-lg font-bold text-green-400">
                            $0.00
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <LockClosedIcon className="w-8 h-8 text-dark-500 mx-auto mb-3" />
                      <p className="text-sm text-dark-400">
                        Connect wallet to view card details
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* KYC / Card Issuance */}
              {!showKYC ? (
                <div className="card">
                  <h3 className="text-base font-semibold text-dark-100 mb-3">
                    Get Your Card
                  </h3>
                  <p className="text-sm text-dark-400 mb-4 leading-relaxed">
                    Complete KYC verification through Rain.xyz to receive your
                    virtual debit card. Once verified, you can fund your card
                    with USDC{isMainnet ? "" : " (from mainnet)"} and spend
                    anywhere Visa is accepted.
                  </p>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex items-center gap-2 text-xs text-dark-400">
                      <ShieldCheckIcon className="w-4 h-4 text-green-400" />
                      <span>KYC via Rain.xyz</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-400">
                      <ClockIcon className="w-4 h-4 text-accent-400" />
                      <span>~5 min verification</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-400">
                      <CheckCircleIcon className="w-4 h-4 text-primary-400" />
                      <span>Instant card issuance</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowKYC(true)}
                    disabled={!isConnected}
                    className="btn-primary text-sm"
                  >
                    {isConnected ? "Start KYC Verification" : "Connect Wallet First"}
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
                  </button>
                </div>
              ) : (
                <div className="card border-primary-500/30">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                      <ShieldCheckIcon className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-dark-100">
                        KYC Verification
                      </h3>
                      <p className="text-xs text-dark-400">
                        Powered by Rain.xyz
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 mb-5">
                    {[
                      { step: "1", label: "Personal Information", status: "current" },
                      { step: "2", label: "Identity Verification", status: "pending" },
                      { step: "3", label: "Address Verification", status: "pending" },
                    ].map((item) => (
                      <div
                        key={item.step}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          item.status === "current"
                            ? "bg-primary-500/5 border-primary-500/20"
                            : "bg-dark-900/30 border-dark-700/30"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            item.status === "current"
                              ? "bg-primary-500 text-white"
                              : "bg-dark-700 text-dark-400"
                          }`}
                        >
                          {item.step}
                        </div>
                        <span
                          className={`text-sm ${
                            item.status === "current"
                              ? "text-dark-100 font-medium"
                              : "text-dark-500"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button className="btn-primary text-sm flex-1">
                      Continue Verification
                      <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
                    </button>
                    <button
                      onClick={() => setShowKYC(false)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Transaction History */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-dark-100">
                    Recent Transactions
                  </h3>
                  <button className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                    View All
                  </button>
                </div>

                {isConnected ? (
                  <div className="divide-y divide-dark-700/30">
                    {mockTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                              tx.amount.startsWith("+")
                                ? "bg-green-500/10 border border-green-500/20"
                                : "bg-dark-700/50 border border-dark-600/30"
                            }`}
                          >
                            {tx.amount.startsWith("+") ? (
                              <ArrowPathIcon className="w-4 h-4 text-green-400" />
                            ) : (
                              <CreditCardIcon className="w-4 h-4 text-dark-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-dark-200">
                              {tx.merchant}
                            </p>
                            <p className="text-xs text-dark-500">{tx.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-medium ${
                              tx.amount.startsWith("+")
                                ? "text-green-400"
                                : "text-dark-200"
                            }`}
                          >
                            {tx.amount}
                          </p>
                          <span
                            className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                              statusStyles[tx.status]
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CreditCardIcon className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                    <p className="text-sm text-dark-500">
                      Connect wallet to view transactions
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Top-up + Auto Top-up */}
            <div className="lg:col-span-5 space-y-6">
              {/* Fund Card */}
              <div className="card">
                <h3 className="text-base font-semibold text-dark-100 mb-4">
                  Fund Your Card
                </h3>

                <div className="space-y-4">
                  {/* Source Selection */}
                  <div>
                    <label className="text-xs text-dark-400 mb-2 block">
                      Funding Source
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTopupSource("wallet")}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          topupSource === "wallet"
                            ? "bg-primary-500/5 border-primary-500/30 ring-1 ring-primary-500/20"
                            : "bg-dark-900/30 border-dark-700/30 hover:border-dark-600"
                        }`}
                      >
                        <BanknotesIcon
                          className={`w-5 h-5 mb-1.5 ${
                            topupSource === "wallet"
                              ? "text-primary-400"
                              : "text-dark-500"
                          }`}
                        />
                        <p
                          className={`text-sm font-medium ${
                            topupSource === "wallet"
                              ? "text-dark-100"
                              : "text-dark-400"
                          }`}
                        >
                          USDC Wallet
                        </p>
                        <p className="text-[10px] text-dark-500 mt-0.5">
                          {isMainnet
                            ? "From connected wallet"
                            : "Mainnet USDC required"}
                        </p>
                      </button>
                      <button
                        onClick={() => setTopupSource("vault-c")}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          topupSource === "vault-c"
                            ? "bg-primary-500/5 border-primary-500/30 ring-1 ring-primary-500/20"
                            : "bg-dark-900/30 border-dark-700/30 hover:border-dark-600"
                        }`}
                      >
                        <BoltIcon
                          className={`w-5 h-5 mb-1.5 ${
                            topupSource === "vault-c"
                              ? "text-primary-400"
                              : "text-dark-500"
                          }`}
                        />
                        <p
                          className={`text-sm font-medium ${
                            topupSource === "vault-c"
                              ? "text-dark-100"
                              : "text-dark-400"
                          }`}
                        >
                          Vault C Yield
                        </p>
                        <p className="text-[10px] text-dark-500 mt-0.5">
                          Withdraw from vmoonUSD
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="text-xs text-dark-400 mb-2 block">
                      Amount (USDC)
                    </label>
                    <div className="flex items-center bg-dark-900/50 rounded-xl border border-dark-600/50 focus-within:border-primary-500/50 transition-all">
                      <span className="text-dark-500 text-sm pl-4">$</span>
                      <input
                        type="number"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-transparent px-2 py-3 text-base font-medium text-dark-50 placeholder:text-dark-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-dark-400 pr-4">USDC</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {["50", "100", "250", "500"].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setTopupAmount(amt)}
                          className="flex-1 py-1.5 rounded-lg bg-dark-700/50 border border-dark-600/30 text-xs text-dark-400 hover:text-dark-200 hover:border-dark-500 transition-all"
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isMainnet && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-500/5 border border-accent-500/20">
                      <InformationCircleIcon className="w-4 h-4 text-accent-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-accent-300/80 leading-relaxed">
                        On Sepolia testnet, card funding requires mainnet USDC.
                        Bridge USDC to fund your card for real-world spending.
                      </p>
                    </div>
                  )}

                  <button
                    disabled={!isConnected || !topupAmount}
                    className="btn-primary w-full text-sm py-3"
                  >
                    {!isConnected
                      ? "Connect Wallet"
                      : `Fund Card with $${topupAmount || "0"} USDC`}
                  </button>
                </div>
              </div>

              {/* Auto Top-up Settings */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-dark-100">
                    Auto Top-up
                  </h3>
                  <button
                    onClick={() => setAutoTopupEnabled(!autoTopupEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoTopupEnabled ? "bg-primary-600" : "bg-dark-600"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        autoTopupEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-dark-400 mb-4 leading-relaxed">
                  Automatically fund your card from Vault C when balance drops
                  below a threshold. Withdraws vmoonUSD, swaps to USDC, and tops
                  up your card.
                </p>

                <div
                  className={`space-y-4 transition-opacity ${
                    autoTopupEnabled ? "opacity-100" : "opacity-40 pointer-events-none"
                  }`}
                >
                  <div>
                    <label className="text-xs text-dark-400 mb-1.5 block">
                      When balance falls below
                    </label>
                    <div className="flex items-center bg-dark-900/50 rounded-xl border border-dark-600/50">
                      <span className="text-dark-500 text-sm pl-4">$</span>
                      <input
                        type="number"
                        value={autoTopupThreshold}
                        onChange={(e) => setAutoTopupThreshold(e.target.value)}
                        className="flex-1 bg-transparent px-2 py-2.5 text-sm font-medium text-dark-50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-dark-400 mb-1.5 block">
                      Top-up amount
                    </label>
                    <div className="flex items-center bg-dark-900/50 rounded-xl border border-dark-600/50">
                      <span className="text-dark-500 text-sm pl-4">$</span>
                      <input
                        type="number"
                        value={autoTopupAmount}
                        onChange={(e) => setAutoTopupAmount(e.target.value)}
                        className="flex-1 bg-transparent px-2 py-2.5 text-sm font-medium text-dark-50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-dark-500">
                    <ClockIcon className="w-3.5 h-3.5" />
                    <span>Max 1 auto top-up per 24 hours</span>
                  </div>

                  <button
                    disabled={!isConnected || !autoTopupEnabled}
                    className="btn-secondary w-full text-sm py-2.5"
                  >
                    Save Auto Top-up Settings
                  </button>
                </div>
              </div>

              {/* Card Features */}
              <div className="card">
                <h3 className="text-sm font-semibold text-dark-200 mb-3">
                  Card Features
                </h3>
                <div className="space-y-2.5">
                  {[
                    {
                      icon: <ShieldCheckIcon className="w-4 h-4 text-green-400" />,
                      text: "Accepted anywhere Visa is accepted",
                    },
                    {
                      icon: <BoltIcon className="w-4 h-4 text-accent-400" />,
                      text: "Instant virtual card issuance",
                    },
                    {
                      icon: <ArrowPathIcon className="w-4 h-4 text-primary-400" />,
                      text: "Auto top-up from Vault C yield",
                    },
                    {
                      icon: <LockClosedIcon className="w-4 h-4 text-dark-400" />,
                      text: "Funds secured on-chain until spent",
                    },
                  ].map((feature) => (
                    <div
                      key={feature.text}
                      className="flex items-center gap-2.5 text-xs text-dark-400"
                    >
                      {feature.icon}
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Credit Card Tab - Coming Soon */
        <div className="max-w-2xl mx-auto">
          <div className="card relative overflow-hidden text-center py-12">
            {/* Background decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-primary-500/5 to-transparent rounded-full blur-3xl" />

            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20 flex items-center justify-center">
                <SparklesIcon className="w-10 h-10 text-primary-400" />
              </div>

              <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent-500/10 border border-accent-500/20 text-xs font-semibold text-accent-400 uppercase tracking-wider mb-4">
                Coming Soon
              </span>

              <h2 className="text-2xl font-bold text-dark-50 mb-3">
                Moonight Credit Card
              </h2>
              <p className="text-dark-400 max-w-md mx-auto mb-8 leading-relaxed">
                Borrow against your DeFi positions with an on-chain credit line.
                Spend now, repay from vault yield. Zero liquidation risk on your
                credit line — backed by protocol treasury.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                {[
                  {
                    title: "Credit Line",
                    desc: "Up to $10,000 based on position value",
                    icon: <BanknotesIcon className="w-5 h-5 text-green-400" />,
                  },
                  {
                    title: "Yield Repay",
                    desc: "Auto-repay from Vault C yield",
                    icon: <ArrowPathIcon className="w-5 h-5 text-accent-400" />,
                  },
                  {
                    title: "Rewards",
                    desc: "Earn MOON tokens on every swipe",
                    icon: <SparklesIcon className="w-5 h-5 text-primary-400" />,
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="p-4 rounded-xl bg-dark-900/30 border border-dark-700/30"
                  >
                    <div className="mb-2">{feature.icon}</div>
                    <p className="text-sm font-medium text-dark-200 mb-1">
                      {feature.title}
                    </p>
                    <p className="text-[11px] text-dark-500 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center gap-3">
                <button disabled className="btn-primary text-sm opacity-60 cursor-not-allowed">
                  Available After Mainnet Launch
                </button>
                <p className="text-xs text-dark-500">
                  Credit cards will be available once the protocol reaches
                  mainnet with sufficient TVL
                </p>
              </div>
            </div>
          </div>

          {/* How It Will Work */}
          <div className="mt-6 p-6 rounded-2xl bg-dark-800/40 border border-dark-700/30">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                <InformationCircleIcon className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dark-200 mb-2">
                  How Moonight Credit Will Work
                </h3>
                <div className="space-y-2 text-sm text-dark-400 leading-relaxed">
                  <p>
                    <strong className="text-dark-300">1. Collateral Assessment</strong>{" "}
                    — Your credit line is calculated based on your CDP positions,
                    vault deposits, and protocol reputation score.
                  </p>
                  <p>
                    <strong className="text-dark-300">2. Instant Credit</strong>{" "}
                    — Spend up to your credit limit anywhere Visa is accepted.
                    No upfront funding needed.
                  </p>
                  <p>
                    <strong className="text-dark-300">3. Yield Repayment</strong>{" "}
                    — Your Vault C yield automatically repays your credit balance.
                    Or repay manually from any source.
                  </p>
                  <p>
                    <strong className="text-dark-300">4. Safety Net</strong>{" "}
                    — Credit lines are backed by protocol treasury, not your
                    positions. Your CDPs stay safe regardless.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk / Info Banner (shown on debit tab) */}
      {activeTab === "debit" && (
        <div className="mt-8 p-6 rounded-2xl bg-dark-800/40 border border-dark-700/30">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center flex-shrink-0">
              <ExclamationTriangleIcon className="w-5 h-5 text-accent-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dark-200 mb-1">
                Important Information
              </h3>
              <p className="text-sm text-dark-400 leading-relaxed">
                The Moonight debit card is powered by Rain.xyz. Card issuance
                requires KYC verification. Funds loaded onto the card are
                converted to fiat and held by Rain&apos;s banking partner.
                {!isMainnet &&
                  " On Sepolia testnet, card funding uses mainnet USDC — testnet tokens cannot be used for real-world spending."}
                {" "}Card spending limits and availability may vary by jurisdiction.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
