"use client";

import { useState, useEffect, useCallback } from "react";
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
  TicketIcon,
} from "@heroicons/react/24/outline";

const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

function getInviteStorageKey(address: string) {
  return `moonight_invite_${address}`;
}

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
  settled: "text-success",
  pending: "text-accent",
  declined: "text-danger",
};

export default function CardPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<CardTab>("debit");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupSource, setTopupSource] = useState<TopupSource>("wallet");
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);
  const [autoTopupThreshold, setAutoTopupThreshold] = useState("50");
  const [autoTopupAmount, setAutoTopupAmount] = useState("200");
  const [showKYC, setShowKYC] = useState(false);

  // Invite code gating state
  const [inviteVerified, setInviteVerified] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Check localStorage for previously verified invite code
  useEffect(() => {
    try {
      if (address) {
        const stored = localStorage.getItem(getInviteStorageKey(address));
        if (stored === "true") {
          setInviteVerified(true);
        } else {
          setInviteVerified(false);
        }
      } else {
        setInviteVerified(false);
      }
    } catch {
      setInviteVerified(false);
    }
  }, [address]);

  const handleVerifyInvite = useCallback(async () => {
    if (!inviteCode.trim() || !address) return;
    setInviteLoading(true);
    setInviteError("");

    try {
      const res = await fetch(`${API_BASE}/api/card/validate-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode.trim(), walletAddress: address }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        setInviteVerified(true);
        try {
          localStorage.setItem(getInviteStorageKey(address), "true");
        } catch { /* storage unavailable */ }
      } else {
        setInviteError(data.error || "Invalid invite code");
      }
    } catch {
      setInviteError("Failed to validate invite code. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  }, [inviteCode, address]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8" data-animate="0">
        <h1 className="text-xl sm:text-2xl font-display font-semibold text-text-0 mb-1">
          Moonight Card
        </h1>
        <p className="text-sm text-text-2">
          Spend your DeFi yield anywhere with virtual debit and credit cards
        </p>
      </div>

      {/* Card Type Tabs — text style */}
      <div className="flex items-center gap-1 border-b border-border/30 mb-10" data-animate="1">
        <button
          onClick={() => setActiveTab("debit")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-display uppercase tracking-[0.12em] border-b-2 -mb-px transition-all ${
            activeTab === "debit"
              ? "text-accent border-accent"
              : "text-text-2 border-transparent hover:text-text-1"
          }`}
        >
          <CreditCardIcon className="w-3.5 h-3.5" />
          Debit Card
        </button>
        <button
          onClick={() => setActiveTab("credit")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-display uppercase tracking-[0.12em] border-b-2 -mb-px transition-all ${
            activeTab === "credit"
              ? "text-accent border-accent"
              : "text-text-2 border-transparent hover:text-text-1"
          }`}
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Credit Card
        </button>
      </div>

      {activeTab === "debit" ? (
        <>
          {/* Debit Card Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10" data-animate="2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">Card Balance</p>
              <p className="text-2xl sm:text-3xl font-mono font-semibold text-text-0 tracking-tight">$0.00</p>
              <p className="text-xs text-text-2 mt-1">{isConnected ? "Available to spend" : "Connect wallet"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">Monthly Spent</p>
              <p className="text-2xl sm:text-3xl font-mono font-semibold text-text-0 tracking-tight">$0.00</p>
              <p className="text-xs text-text-2 mt-1">This month</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-1.5">Total Top-ups</p>
              <p className="text-2xl sm:text-3xl font-mono font-semibold text-text-0 tracking-tight">$0.00</p>
              <p className="text-xs text-text-2 mt-1">Lifetime</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Virtual Card Visual + Actions */}
            <div className="lg:col-span-7 space-y-8">
              {/* Virtual Card */}
              <div className="relative overflow-hidden bg-surface-1 border border-border/50 p-6" data-animate="3">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-surface-2/30" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      {/* Moon logo on card */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="-76 -76 152 152"
                        className="w-6 h-6 text-text-0"
                        fill="currentColor"
                      >
                        <circle cx="0" cy="0" r="72" fill="none" stroke="currentColor" strokeWidth="2.5" />
                        <clipPath id="card-moon">
                          <circle cx="0" cy="0" r="72" />
                        </clipPath>
                        <circle cx="22" cy="0" r="62" fill="currentColor" clipPath="url(#card-moon)" />
                        <circle cx="-34" cy="-25" r="3.5" fill="currentColor" />
                      </svg>
                      <span className="text-xs font-display tracking-[0.2em] uppercase text-text-1">
                        Moonight
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-text-2 font-display">
                        Virtual Debit
                      </span>
                    </div>
                  </div>

                  {isConnected ? (
                    <>
                      <p className="text-2xl font-mono tracking-[0.2em] text-text-1 mb-6">
                        •••• •••• •••• 4832
                      </p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-text-2 mb-0.5 font-display">
                            Cardholder
                          </p>
                          <p className="text-sm text-text-1 font-mono">
                            MOONIGHT USER
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-text-2 mb-0.5 font-display">
                            Expires
                          </p>
                          <p className="text-sm text-text-1 font-mono">
                            12/27
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-text-2 mb-0.5 font-display">
                            Balance
                          </p>
                          <p className="text-lg font-mono font-semibold text-accent">
                            $0.00
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <LockClosedIcon className="w-6 h-6 text-text-2 mx-auto mb-3" />
                      <p className="text-sm text-text-2">
                        Connect wallet to view card details
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Invite Code Gate / KYC / Card Issuance */}
              {!inviteVerified ? (
                <div className="border-t border-border/30 pt-8" data-animate="4">
                  <div className="flex items-center gap-3 mb-4">
                    <TicketIcon className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-display text-text-0">
                      Invite Only Access
                    </h3>
                  </div>
                  <p className="text-xs text-text-2 mb-4 leading-relaxed">
                    The Moonight Card is currently in early access. Enter an
                    invite code shared via our Discord or Telegram community to
                    proceed with KYC and card issuance.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center border-b border-border focus-within:border-accent transition-colors">
                      <TicketIcon className="w-3.5 h-3.5 text-text-2 mr-2" />
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value.toUpperCase());
                          setInviteError("");
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleVerifyInvite(); }}
                        placeholder="MOON-XXXX-XXXX"
                        className="flex-1 bg-transparent py-2.5 text-sm font-mono text-text-0 placeholder:text-text-2/30 focus:outline-none tracking-wider"
                        disabled={!isConnected}
                      />
                    </div>
                    {inviteError && (
                      <p className="text-xs text-danger flex items-center gap-1.5">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                        {inviteError}
                      </p>
                    )}
                    <button
                      onClick={handleVerifyInvite}
                      disabled={!isConnected || !inviteCode.trim() || inviteLoading}
                      className="btn-primary text-sm w-full"
                    >
                      {!isConnected
                        ? "Connect Wallet First"
                        : inviteLoading
                        ? "Verifying..."
                        : "Verify Invite Code"}
                    </button>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/20">
                    <p className="text-xs text-text-2 leading-relaxed">
                      Don&apos;t have a code? Join our{" "}
                      <a
                        href="https://discord.gg/cZa7YpyQ"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent/80 transition-colors"
                      >
                        Discord
                      </a>{" "}
                      or{" "}
                      <a
                        href="https://t.me/moonight"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent/80 transition-colors"
                      >
                        Telegram
                      </a>{" "}
                      to request early access.
                    </p>
                  </div>
                </div>
              ) : !showKYC ? (
                <div className="border-t border-border/30 pt-8" data-animate="4">
                  <h3 className="text-sm font-display text-text-0 mb-3">
                    Get Your Card
                  </h3>
                  <p className="text-xs text-text-2 mb-4 leading-relaxed">
                    Complete KYC verification through Rain.xyz to receive your
                    virtual debit card. Once verified, you can fund your card
                    with USDC{isMainnet ? "" : " (from mainnet)"} and spend
                    anywhere Visa is accepted.
                  </p>
                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex items-center gap-1.5 text-[11px] text-text-2">
                      <ShieldCheckIcon className="w-3.5 h-3.5 text-success" />
                      <span>KYC via Rain.xyz</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-text-2">
                      <ClockIcon className="w-3.5 h-3.5 text-accent" />
                      <span>~5 min verification</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-text-2">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-success" />
                      <span>Instant card issuance</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowKYC(true)}
                    disabled={!isConnected}
                    className="btn-primary text-sm"
                  >
                    {isConnected ? "Start KYC Verification" : "Connect Wallet First"}
                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 ml-2" />
                  </button>
                </div>
              ) : (
                <div className="border-t border-accent/20 pt-8" data-animate="4">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheckIcon className="w-4 h-4 text-accent" />
                    <div>
                      <h3 className="text-sm font-display text-text-0">
                        KYC Verification
                      </h3>
                      <p className="text-[10px] text-text-2">
                        Powered by Rain.xyz
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-5">
                    {[
                      { step: "1", label: "Personal Information", status: "current" },
                      { step: "2", label: "Identity Verification", status: "pending" },
                      { step: "3", label: "Address Verification", status: "pending" },
                    ].map((item) => (
                      <div
                        key={item.step}
                        className={`flex items-center gap-3 py-2.5 px-3 border-l-2 ${
                          item.status === "current"
                            ? "border-accent bg-accent/5"
                            : "border-border/30"
                        }`}
                      >
                        <span
                          className={`text-xs font-mono font-semibold ${
                            item.status === "current"
                              ? "text-accent"
                              : "text-text-2"
                          }`}
                        >
                          {item.step}
                        </span>
                        <span
                          className={`text-sm ${
                            item.status === "current"
                              ? "text-text-0"
                              : "text-text-2"
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
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 ml-2" />
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
              <div className="border-t border-border/30 pt-8" data-animate="5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-display text-text-0">
                    Recent Transactions
                  </h3>
                  <button className="text-[10px] text-accent hover:text-accent/80 font-display uppercase tracking-wider transition-colors">
                    View All
                  </button>
                </div>

                {isConnected ? (
                  <div className="divide-y divide-border/20">
                    {mockTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 flex items-center justify-center ${
                              tx.amount.startsWith("+")
                                ? "text-success"
                                : "text-text-2"
                            }`}
                          >
                            {tx.amount.startsWith("+") ? (
                              <ArrowPathIcon className="w-4 h-4" />
                            ) : (
                              <CreditCardIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-text-0">
                              {tx.merchant}
                            </p>
                            <p className="text-[10px] text-text-2 font-mono">{tx.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-mono ${
                              tx.amount.startsWith("+")
                                ? "text-success"
                                : "text-text-0"
                            }`}
                          >
                            {tx.amount}
                          </p>
                          <span className={`text-[10px] font-mono ${statusStyles[tx.status]}`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CreditCardIcon className="w-6 h-6 text-text-2 mx-auto mb-2" />
                    <p className="text-xs text-text-2">
                      Connect wallet to view transactions
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Top-up + Auto Top-up */}
            <div className="lg:col-span-5 space-y-0">
              {/* Fund Card */}
              <div className="pb-8 border-b border-border/30" data-animate="3">
                <h3 className="text-sm font-display text-text-0 mb-4">
                  Fund Your Card
                </h3>

                <div className="space-y-4">
                  {/* Source Selection */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-2 block">
                      Funding Source
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTopupSource("wallet")}
                        className={`flex-1 py-2.5 px-3 text-left border transition-all ${
                          topupSource === "wallet"
                            ? "border-accent bg-accent/5"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <BanknotesIcon className={`w-4 h-4 mb-1 ${topupSource === "wallet" ? "text-accent" : "text-text-2"}`} />
                        <p className={`text-xs font-display ${topupSource === "wallet" ? "text-text-0" : "text-text-2"}`}>
                          USDC Wallet
                        </p>
                        <p className="text-[10px] text-text-2 mt-0.5">
                          {isMainnet ? "From connected wallet" : "Mainnet USDC required"}
                        </p>
                      </button>
                      <button
                        onClick={() => setTopupSource("vault-c")}
                        className={`flex-1 py-2.5 px-3 text-left border transition-all ${
                          topupSource === "vault-c"
                            ? "border-accent bg-accent/5"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <BoltIcon className={`w-4 h-4 mb-1 ${topupSource === "vault-c" ? "text-accent" : "text-text-2"}`} />
                        <p className={`text-xs font-display ${topupSource === "vault-c" ? "text-text-0" : "text-text-2"}`}>
                          Vault C Yield
                        </p>
                        <p className="text-[10px] text-text-2 mt-0.5">
                          Withdraw from vmoonUSD
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-2 block">
                      Amount (USDC)
                    </label>
                    <div className="flex items-center border-b border-border focus-within:border-accent transition-colors">
                      <span className="text-text-2 text-sm font-mono">$</span>
                      <input
                        type="number"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-transparent px-2 py-2.5 text-base font-mono text-text-0 placeholder:text-text-2/30 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-text-2 font-mono">USDC</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {["50", "100", "250", "500"].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setTopupAmount(amt)}
                          className="flex-1 py-1 text-xs font-mono text-text-2 border border-border/50 hover:border-border hover:text-text-1 transition-all"
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isMainnet && (
                    <div className="flex items-start gap-2 p-3 border-l-2 border-accent bg-accent/5">
                      <InformationCircleIcon className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-text-2 leading-relaxed">
                        On Sepolia testnet, card funding requires mainnet USDC.
                        Bridge USDC to fund your card for real-world spending.
                      </p>
                    </div>
                  )}

                  <button
                    disabled={!isConnected || !topupAmount}
                    className="btn-primary w-full text-sm py-2.5"
                  >
                    {!isConnected
                      ? "Connect Wallet"
                      : `Fund Card with $${topupAmount || "0"} USDC`}
                  </button>
                </div>
              </div>

              {/* Auto Top-up Settings */}
              <div className="py-8 border-b border-border/30" data-animate="4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-display text-text-0">
                    Auto Top-up
                  </h3>
                  <button
                    onClick={() => setAutoTopupEnabled(!autoTopupEnabled)}
                    className={`relative w-10 h-5 transition-colors ${
                      autoTopupEnabled ? "bg-accent" : "bg-border"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-surface-0 transition-transform ${
                        autoTopupEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-text-2 mb-4 leading-relaxed">
                  Automatically fund your card from Vault C when balance drops
                  below a threshold.
                </p>

                <div
                  className={`space-y-4 transition-opacity ${
                    autoTopupEnabled ? "opacity-100" : "opacity-30 pointer-events-none"
                  }`}
                >
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-1.5 block">
                      When balance falls below
                    </label>
                    <div className="flex items-center border-b border-border">
                      <span className="text-text-2 text-sm font-mono">$</span>
                      <input
                        type="number"
                        value={autoTopupThreshold}
                        onChange={(e) => setAutoTopupThreshold(e.target.value)}
                        className="flex-1 bg-transparent px-2 py-2 text-sm font-mono text-text-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-text-2 font-display mb-1.5 block">
                      Top-up amount
                    </label>
                    <div className="flex items-center border-b border-border">
                      <span className="text-text-2 text-sm font-mono">$</span>
                      <input
                        type="number"
                        value={autoTopupAmount}
                        onChange={(e) => setAutoTopupAmount(e.target.value)}
                        className="flex-1 bg-transparent px-2 py-2 text-sm font-mono text-text-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-text-2 font-mono">
                    <ClockIcon className="w-3 h-3" />
                    <span>Max 1 auto top-up per 24 hours</span>
                  </div>

                  <button
                    disabled={!isConnected || !autoTopupEnabled}
                    className="btn-secondary w-full text-sm py-2"
                  >
                    Save Auto Top-up Settings
                  </button>
                </div>
              </div>

              {/* Card Features */}
              <div className="py-8" data-animate="5">
                <h3 className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-3">
                  Card Features
                </h3>
                <div className="space-y-2">
                  {[
                    { icon: <ShieldCheckIcon className="w-3.5 h-3.5 text-success" />, text: "Accepted anywhere Visa is accepted" },
                    { icon: <BoltIcon className="w-3.5 h-3.5 text-accent" />, text: "Instant virtual card issuance" },
                    { icon: <ArrowPathIcon className="w-3.5 h-3.5 text-accent" />, text: "Auto top-up from Vault C yield" },
                    { icon: <LockClosedIcon className="w-3.5 h-3.5 text-text-2" />, text: "Funds secured on-chain until spent" },
                  ].map((feature) => (
                    <div key={feature.text} className="flex items-center gap-2 text-xs text-text-2">
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
          <div className="text-center py-12" data-animate="2">
            <SparklesIcon className="w-10 h-10 text-accent mx-auto mb-6" />

            <span className="inline-flex items-center px-3 py-1 text-[10px] font-display uppercase tracking-wider text-accent border border-accent/20 mb-4">
              Coming Soon
            </span>

            <h2 className="text-xl font-display font-semibold text-text-0 mb-3">
              Moonight Credit Card
            </h2>
            <p className="text-sm text-text-2 max-w-md mx-auto mb-10 leading-relaxed">
              Borrow against your DeFi positions with an on-chain credit line.
              Spend now, repay from vault yield. Zero liquidation risk on your
              credit line — backed by protocol treasury.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-lg mx-auto mb-10">
              {[
                { title: "Credit Line", desc: "Up to $10,000 based on position value" },
                { title: "Yield Repay", desc: "Auto-repay from Vault C yield" },
                { title: "Rewards", desc: "Earn MOON tokens on every swipe" },
              ].map((feature) => (
                <div key={feature.title}>
                  <p className="text-sm font-display text-text-0 mb-1">
                    {feature.title}
                  </p>
                  <p className="text-[11px] text-text-2 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              <button disabled className="btn-primary text-sm opacity-50 cursor-not-allowed">
                Available After Mainnet Launch
              </button>
              <p className="text-xs text-text-2">
                Credit cards will be available once the protocol reaches
                mainnet with sufficient TVL
              </p>
            </div>
          </div>

          {/* How It Will Work */}
          <div className="mt-8 border-t border-border/30 pt-8">
            <div className="flex items-start gap-4">
              <InformationCircleIcon className="w-4 h-4 text-text-2 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-display text-text-0 mb-2">
                  How Moonight Credit Will Work
                </h3>
                <div className="space-y-2 text-xs text-text-2 leading-relaxed">
                  <p>
                    <strong className="text-text-1">1. Collateral Assessment</strong>{" "}
                    — Your credit line is calculated based on your CDP positions,
                    vault deposits, and protocol reputation score.
                  </p>
                  <p>
                    <strong className="text-text-1">2. Instant Credit</strong>{" "}
                    — Spend up to your credit limit anywhere Visa is accepted.
                    No upfront funding needed.
                  </p>
                  <p>
                    <strong className="text-text-1">3. Yield Repayment</strong>{" "}
                    — Your Vault C yield automatically repays your credit balance.
                    Or repay manually from any source.
                  </p>
                  <p>
                    <strong className="text-text-1">4. Safety Net</strong>{" "}
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
        <div className="mt-10 border-t border-border/30 pt-8">
          <div className="flex items-start gap-4">
            <ExclamationTriangleIcon className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-display text-text-0 mb-1">
                Important Information
              </h3>
              <p className="text-xs text-text-2 leading-relaxed">
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
