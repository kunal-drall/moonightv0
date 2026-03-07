"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAccount } from "@starknet-react/core";
import {
  InformationCircleIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { Contract, cairo, RpcProvider } from "starknet";
import { ABIS, CONTRACT_ADDRESSES } from "@/hooks/useMoonightContracts";
import { useUnifiedWallet } from "@/hooks/useStarkzapWallet";
import { WBTC as WBTC_TOKEN } from "@/lib/tokens";
import { Amount } from "starkzap";
import type { Address } from "starkzap";

const EXPLORER_BASE = "https://sepolia.voyager.online";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo";

/** Convert a decimal string (e.g. "1000.5") to BigInt with given decimals, avoiding float precision loss */
function parseToBigInt(value: string, decimals: number): bigint {
  if (!value || value === ".") return BigInt(0);
  const [whole = "0", frac = ""] = value.split(".");
  const paddedFrac = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFrac);
}

/** Format a bigint with decimals for display using string manipulation */
function formatBigInt(val: bigint, decimals: number, maxFracDigits = 2): string {
  const str = val.toString();
  if (str.length <= decimals) {
    const padded = str.padStart(decimals, "0");
    const frac = padded.slice(0, maxFracDigits);
    return `0.${frac}`;
  }
  const wholePart = str.slice(0, str.length - decimals);
  const fracPart = str.slice(str.length - decimals, str.length - decimals + maxFracDigits);
  const num = parseFloat(`${wholePart}.${fracPart}`);
  return num.toLocaleString("en-US", { maximumFractionDigits: maxFracDigits });
}

/** Sanitize a numeric input value — only allow non-negative finite numbers */
function sanitizeNumericInput(value: string): string {
  const clean = value.replace(/[^0-9.]/g, "");
  // Ensure only one decimal point
  const parts = clean.split(".");
  if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");
  const num = parseFloat(clean);
  if (clean !== "" && (isNaN(num) || !isFinite(num) || num < 0)) return "";
  return clean;
}

/** Map contract/RPC errors to user-friendly messages */
function getUserFriendlyError(e: any): string {
  const msg = String(e?.message || "");
  if (msg.includes("User abort") || msg.includes("rejected")) return "Transaction rejected by wallet.";
  if (msg.includes("insufficient") || msg.includes("balance")) return "Insufficient balance for this transaction.";
  if (msg.includes("nonce")) return "Transaction nonce error. Please try again.";
  if (msg.includes("execution_error")) return "Contract execution failed. Check your inputs and try again.";
  return "Transaction failed. Please try again.";
}

function useLiveBtcPrice(fallback: number) {
  const [price, setPrice] = useState(fallback);
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        if (!res.ok) return;
        const data = await res.json();
        const p = Number(data?.bitcoin?.usd);
        if (!isNaN(p) && isFinite(p) && p > 0) setPrice(p);
      } catch {
        /* keep fallback */
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);
  return price;
}

const MIN_COLLATERAL_RATIO = 125; // 80% LTV = 125% min c-ratio

const INTEREST_RATES = [
  { label: "0.5%", value: 50, description: "Minimum rate" },
  { label: "1%", value: 100, description: "Standard" },
  { label: "2%", value: 200, description: "Moderate" },
  { label: "5%", value: 500, description: "Higher rate" },
];

const MIN_DEBT_MOONUSD = 200;
const WBTC_DECIMALS = 8;
const MOONUSD_DECIMALS = 18;

function getHealthFactorColor(hf: number): string {
  if (hf >= 2.0) return "text-success";
  if (hf >= 1.5) return "text-accent";
  if (hf >= 1.3) return "text-accent";
  return "text-danger";
}

function getHealthFactorLabel(hf: number): string {
  if (hf >= 2.0) return "Excellent";
  if (hf >= 1.5) return "Good";
  if (hf >= 1.3) return "Risky";
  return "Dangerous";
}

function getHealthFactorBarWidth(hf: number): string {
  const clamped = Math.min(Math.max(hf, 0), 3);
  return `${(clamped / 3) * 100}%`;
}

function getHealthFactorBarColor(hf: number): string {
  if (hf >= 2.0) return "bg-success";
  if (hf >= 1.5) return "bg-accent";
  if (hf >= 1.3) return "bg-accent";
  return "bg-danger";
}

export default function MintPage() {
  const { address, account, szWallet, isConnected, source } = useUnifiedWallet();
  const BTC_PRICE = useLiveBtcPrice(90000);
  const [collateralAmount, setCollateralAmount] = useState<string>("");
  const [borrowAmount, setBorrowAmount] = useState<string>("");
  const [selectedRate, setSelectedRate] = useState<number>(1);
  const [wbtcBalance, setWbtcBalance] = useState<string>("0.00");
  const [txHash, setTxHash] = useState("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState("");
  const [totalDebt, setTotalDebt] = useState<string>("0");
  const [activePositions, setActivePositions] = useState<string>("0");
  // Capture tx params at submission time so success message is stable
  const [submittedParams, setSubmittedParams] = useState<{ collateral: string; borrow: string } | null>(null);
  const mintingRef = useRef(false);

  // Fetch WBTC balance
  useEffect(() => {
    if (!address || !isConnected || CONTRACT_ADDRESSES.mockWbtc === "0x0") return;
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const wbtc = new Contract({ abi: ABIS.erc20, address: CONTRACT_ADDRESSES.mockWbtc, providerOrAccount: provider });
    wbtc.balance_of(address).then((bal: bigint) => {
      const formatted = Number(bal) / 10 ** WBTC_DECIMALS;
      setWbtcBalance(formatted.toFixed(WBTC_DECIMALS));
    }).catch(() => {});
  }, [address, isConnected, txHash]);

  // Fetch protocol stats
  useEffect(() => {
    if (CONTRACT_ADDRESSES.cdpManager === "0x0") return;
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const cdp = new Contract({ abi: ABIS.cdpManager, address: CONTRACT_ADDRESSES.cdpManager, providerOrAccount: provider });
    cdp.get_total_debt().then((d: bigint) => {
      setTotalDebt(formatBigInt(d, MOONUSD_DECIMALS));
    }).catch(() => {});
    cdp.get_active_positions().then((n: bigint) => {
      setActivePositions(Number(n).toString());
    }).catch(() => {});
  }, [txHash]);

  const collateralValue = useMemo(() => {
    const amount = parseFloat(collateralAmount) || 0;
    return amount * BTC_PRICE;
  }, [collateralAmount, BTC_PRICE]);

  const maxBorrow = useMemo(() => {
    return collateralValue * 0.8;
  }, [collateralValue]);

  const collateralRatio = useMemo(() => {
    const borrow = parseFloat(borrowAmount) || 0;
    if (borrow <= 0) return 0;
    return Math.min((collateralValue / borrow) * 100, 99999);
  }, [collateralValue, borrowAmount]);

  const healthFactor = useMemo(() => {
    const borrow = parseFloat(borrowAmount) || 0;
    if (borrow <= 0) return 0;
    return Math.min((collateralValue * 0.8) / borrow, 99);
  }, [collateralValue, borrowAmount]);

  const liquidationPrice = useMemo(() => {
    const borrow = parseFloat(borrowAmount) || 0;
    const collateral = parseFloat(collateralAmount) || 0;
    if (collateral <= 0) return 0;
    return borrow / (collateral * 0.8);
  }, [collateralAmount, borrowAmount]);

  const isValidPosition = useMemo(() => {
    const collateral = parseFloat(collateralAmount) || 0;
    const borrow = parseFloat(borrowAmount) || 0;
    return (
      collateral > 0 &&
      borrow >= MIN_DEBT_MOONUSD &&
      collateralRatio >= MIN_COLLATERAL_RATIO
    );
  }, [collateralAmount, borrowAmount, collateralRatio]);

  const handleMint = useCallback(async () => {
    // Ref-based guard prevents double-submit (React state is async)
    if (mintingRef.current) return;
    if (!address || !account) return;

    // Re-validate inputs directly (avoid stale closure from isValidPosition)
    const collateral = parseFloat(collateralAmount);
    const borrow = parseFloat(borrowAmount);
    if (!collateral || collateral <= 0 || !borrow || borrow < MIN_DEBT_MOONUSD) return;
    const cRatio = ((collateral * BTC_PRICE) / borrow) * 100;
    if (cRatio < MIN_COLLATERAL_RATIO) return;

    mintingRef.current = true;
    setMinting(true);
    setError("");
    setTxHash("");
    setSubmittedParams({ collateral: collateralAmount, borrow: borrowAmount });

    try {
      const rate = INTEREST_RATES[selectedRate] ?? INTEREST_RATES[0];
      const rateBps = rate.value;

      // Use string-based BigInt conversion to avoid float precision loss
      const collateralSats = parseToBigInt(collateralAmount, WBTC_DECIMALS);
      const mintWei = parseToBigInt(borrowAmount, MOONUSD_DECIMALS);
      const rateBigInt = BigInt(rateBps);

      if (collateralSats <= BigInt(0) || mintWei <= BigInt(0)) return;

      // Starkzap path: use tx builder for batched gasless execution
      if (szWallet && source === "starkzap") {
        const approveAmount = Amount.fromRaw(collateralSats, WBTC_TOKEN);
        const cdpAddr = CONTRACT_ADDRESSES.cdpManager as Address;
        const { low: cLow, high: cHigh } = cairo.uint256(collateralSats);
        const { low: mLow, high: mHigh } = cairo.uint256(mintWei);
        const { low: rLow, high: rHigh } = cairo.uint256(rateBigInt);

        const tx = await szWallet
          .tx()
          .approve(WBTC_TOKEN, cdpAddr, approveAmount)
          .add({
            contractAddress: cdpAddr,
            entrypoint: "open_position",
            calldata: [
              "0x57425443", // felt252 for "WBTC"
              cLow.toString(), cHigh.toString(),
              mLow.toString(), mHigh.toString(),
              rLow.toString(), rHigh.toString(),
            ],
          })
          .send();

        setTxHash(tx.hash);
      } else {
        // Standard starknet-react path (Braavos/Ready wallets)
        const wbtc = new Contract({ abi: ABIS.erc20, address: CONTRACT_ADDRESSES.mockWbtc, providerOrAccount: account });
        const cdpManager = new Contract({ abi: ABIS.cdpManager, address: CONTRACT_ADDRESSES.cdpManager, providerOrAccount: account });

        const approveCall = wbtc.populate("approve", {
          spender: CONTRACT_ADDRESSES.cdpManager,
          amount: cairo.uint256(collateralSats),
        });

        const openCall = cdpManager.populate("open_position", {
          collateral_type: "WBTC",
          collateral_amount: cairo.uint256(collateralSats),
          mint_amount: cairo.uint256(mintWei),
          interest_rate: cairo.uint256(rateBigInt),
        });

        const result = await account!.execute([approveCall, openCall]);
        setTxHash(result.transaction_hash);
      }
    } catch (e: any) {
      console.error("Mint failed:", e);
      setError(getUserFriendlyError(e));
    } finally {
      mintingRef.current = false;
      setMinting(false);
    }
  }, [address, account, szWallet, source, collateralAmount, borrowAmount, selectedRate, BTC_PRICE]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-10" data-animate="0">
        <h1 className="text-xl sm:text-2xl font-display font-semibold text-text-0 mb-1">
          Mint moonUSD
        </h1>
        <p className="text-sm text-text-2">
          Deposit WBTC as collateral to mint moonUSD stablecoin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Main Form - Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Collateral Input */}
          <div data-animate="1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display uppercase tracking-[0.12em] text-text-1">
                Collateral
              </h2>
              <span className="text-xs font-mono text-text-2">
                Balance: {wbtcBalance} WBTC
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center border-b border-border focus-within:border-accent transition-colors">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(sanitizeNumericInput(e.target.value))}
                  placeholder="0.00"
                  className="flex-1 bg-transparent py-3 text-2xl font-mono font-semibold text-text-0 placeholder:text-text-2/30 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-[10px] font-mono font-bold text-accent bg-accent/10 px-1.5 py-0.5">
                    B
                  </span>
                  <span className="text-sm font-display text-text-1">
                    WBTC
                  </span>
                </div>
              </div>
              {collateralValue > 0 && (
                <p className="text-xs font-mono text-text-2 mt-1.5">
                  ~${collateralValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex items-center gap-2 mt-3">
              {["0.01", "0.1", "0.5", "1.0"].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setCollateralAmount(amount)}
                  className="px-3 py-1 text-xs font-mono text-text-2 border border-border/50 hover:border-border hover:text-text-1 transition-all"
                >
                  {amount}
                </button>
              ))}
              <button
                onClick={() => setCollateralAmount(wbtcBalance)}
                className="px-3 py-1 text-xs font-mono text-text-2 border border-border/50 hover:border-border hover:text-text-1 transition-all"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Arrow Separator */}
          <div className="flex justify-center -my-4">
            <div className="w-8 h-8 border border-border/50 flex items-center justify-center bg-surface-0">
              <ArrowsRightLeftIcon className="w-3.5 h-3.5 text-text-2 rotate-90" />
            </div>
          </div>

          {/* Borrow Output */}
          <div data-animate="2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display uppercase tracking-[0.12em] text-text-1">
                Borrow
              </h2>
              <span className="text-xs font-mono text-text-2">
                Max: {maxBorrow > 0 ? maxBorrow.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0.00"} moonUSD
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center border-b border-border focus-within:border-accent transition-colors">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={borrowAmount}
                  onChange={(e) => setBorrowAmount(sanitizeNumericInput(e.target.value))}
                  placeholder="0.00"
                  className="flex-1 bg-transparent py-3 text-2xl font-mono font-semibold text-text-0 placeholder:text-text-2/30 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-sm font-display text-text-1">
                    moonUSD
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Percentage Buttons */}
            <div className="flex items-center gap-2 mt-3">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const val = (maxBorrow * pct) / 100;
                    setBorrowAmount(val > 0 ? val.toFixed(2) : "");
                  }}
                  className="px-3 py-1 text-xs font-mono text-text-2 border border-border/50 hover:border-border hover:text-text-1 transition-all"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Interest Rate Selector */}
          <div data-animate="3">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-display uppercase tracking-[0.12em] text-text-1">
                Interest Rate
              </h2>
              <div className="group relative">
                <InformationCircleIcon className="w-3.5 h-3.5 text-text-2 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-surface-1 border border-border text-xs text-text-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Choose your annual interest rate. Lower rates are cheaper but
                  positions are redeemed first during redemptions.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 border-b border-border/30">
              {INTEREST_RATES.map((rate, i) => (
                <button
                  key={rate.value}
                  onClick={() => setSelectedRate(i)}
                  className={`px-4 py-2.5 text-sm font-mono transition-all duration-200 border-b-2 -mb-px ${
                    selectedRate === i
                      ? "text-accent border-accent"
                      : "text-text-2 border-transparent hover:text-text-1"
                  }`}
                >
                  {rate.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-2 mt-2 font-mono">
              {(INTEREST_RATES[selectedRate] ?? INTEREST_RATES[0]).description}
            </p>
          </div>

          {/* Validation Warnings */}
          {parseFloat(borrowAmount) > 0 && parseFloat(borrowAmount) < MIN_DEBT_MOONUSD && (
            <div className="flex items-start gap-3 p-4 border-l-2 border-danger bg-danger/5" data-animate="4">
              <ExclamationTriangleIcon className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-display text-danger">
                  Below minimum debt
                </p>
                <p className="text-xs text-danger/70 mt-0.5">
                  Minimum borrow is {MIN_DEBT_MOONUSD} moonUSD.
                </p>
              </div>
            </div>
          )}

          {parseFloat(borrowAmount) >= MIN_DEBT_MOONUSD &&
            collateralRatio > 0 &&
            collateralRatio < MIN_COLLATERAL_RATIO && (
              <div className="flex items-start gap-3 p-4 border-l-2 border-danger bg-danger/5">
                <ExclamationTriangleIcon className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-display text-danger">
                    Insufficient collateral
                  </p>
                  <p className="text-xs text-danger/70 mt-0.5">
                    Your collateral ratio ({collateralRatio.toFixed(0)}%) is
                    below the minimum {MIN_COLLATERAL_RATIO}%. Reduce your
                    borrow amount or add more collateral.
                  </p>
                </div>
              </div>
            )}

          {/* Mint Button */}
          <button
            onClick={handleMint}
            disabled={!isConnected || !isValidPosition || minting}
            className="btn-primary w-full text-sm py-3.5"
            data-animate="5"
          >
            {!isConnected
              ? "Connect Wallet to Mint"
              : minting
              ? "Confirming in Wallet..."
              : !isValidPosition
                ? parseFloat(borrowAmount) > 0 && parseFloat(borrowAmount) < MIN_DEBT_MOONUSD
                  ? `Minimum ${MIN_DEBT_MOONUSD} moonUSD`
                  : "Enter Valid Amounts"
                : "Mint moonUSD"}
          </button>

          {/* Success */}
          {txHash && submittedParams && (
            <div className="p-4 border-l-2 border-success bg-success/5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-4 h-4 text-success" />
                <p className="text-sm font-display text-success">
                  Position opened successfully!
                </p>
              </div>
              <p className="text-xs text-text-2 mb-2">
                You deposited {submittedParams.collateral} WBTC and minted {parseFloat(submittedParams.borrow).toLocaleString()} moonUSD.
              </p>
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
            <div className="p-4 border-l-2 border-danger bg-danger/5">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-danger flex-shrink-0" />
                <p className="text-xs text-danger/80">{error}</p>
              </div>
            </div>
          )}

          {isValidPosition && !txHash && (
            <div className="flex items-center justify-center gap-2 text-xs text-text-2">
              <CheckCircleIcon className="w-3.5 h-3.5 text-success" />
              <span>
                You will deposit {collateralAmount} WBTC and receive{" "}
                {parseFloat(borrowAmount).toLocaleString()} moonUSD
              </span>
            </div>
          )}
        </div>

        {/* Right Sidebar - Position Details */}
        <div className="space-y-0">
          {/* Health Factor */}
          <div className="py-6 border-b border-border/30" data-animate="2">
            <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-4">
              Health Factor
            </p>

            <div className="flex items-baseline gap-3 mb-4">
              <p
                className={`text-4xl font-mono font-semibold ${
                  healthFactor > 0
                    ? getHealthFactorColor(healthFactor)
                    : "text-text-2/30"
                }`}
              >
                {healthFactor > 0 ? healthFactor.toFixed(2) : "--"}
              </p>
              <p
                className={`text-xs font-display ${
                  healthFactor > 0
                    ? getHealthFactorColor(healthFactor)
                    : "text-text-2/30"
                }`}
              >
                {healthFactor > 0 ? getHealthFactorLabel(healthFactor) : "No position"}
              </p>
            </div>

            {/* Health Factor Bar — thin line */}
            <div className="w-full h-[2px] bg-border/30 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 ${
                  healthFactor > 0
                    ? getHealthFactorBarColor(healthFactor)
                    : ""
                }`}
                style={{ width: getHealthFactorBarWidth(healthFactor) }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-text-2 font-mono">
              <span>Liquidation</span>
              <span>Safe</span>
            </div>
          </div>

          {/* Position Summary */}
          <div className="py-6 border-b border-border/30" data-animate="3">
            <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-4">
              Position Summary
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Collateral Value</span>
                <span className="text-xs font-mono text-text-0">
                  ${collateralValue > 0 ? collateralValue.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0.00"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Borrow Amount</span>
                <span className="text-xs font-mono text-text-0">
                  {parseFloat(borrowAmount) > 0
                    ? `${parseFloat(borrowAmount).toLocaleString()} moonUSD`
                    : "0.00 moonUSD"}
                </span>
              </div>
              <div className="h-px bg-border/20" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Collateral Ratio</span>
                <span
                  className={`text-xs font-mono ${
                    collateralRatio >= MIN_COLLATERAL_RATIO
                      ? "text-success"
                      : collateralRatio > 0
                        ? "text-danger"
                        : "text-text-2"
                  }`}
                >
                  {collateralRatio > 0 ? `${collateralRatio.toFixed(1)}%` : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Liquidation Price</span>
                <span className="text-xs font-mono text-text-0">
                  {liquidationPrice > 0
                    ? `$${liquidationPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Interest Rate</span>
                <span className="text-xs font-mono text-text-0">
                  {(INTEREST_RATES[selectedRate] ?? INTEREST_RATES[0]).label} APR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Max LTV</span>
                <span className="text-xs font-mono text-text-2">80%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Min. Debt</span>
                <span className="text-xs font-mono text-text-2">
                  {MIN_DEBT_MOONUSD} moonUSD
                </span>
              </div>
            </div>
          </div>

          {/* Protocol Stats */}
          <div className="py-6" data-animate="4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-4">
              Protocol Stats
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">BTC Price</span>
                <span className="text-xs font-mono text-text-0">
                  ${BTC_PRICE.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Total Debt</span>
                <span className="text-xs font-mono text-text-0">
                  {totalDebt} moonUSD
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-2">Active Positions</span>
                <span className="text-xs font-mono text-text-0">
                  {activePositions}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
