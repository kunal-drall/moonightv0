"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import {
  InformationCircleIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import StatsCard from "@/components/StatsCard";
import { Contract, cairo, RpcProvider } from "starknet";
import { ABIS, CONTRACT_ADDRESSES } from "@/hooks/useMoonightContracts";

const EXPLORER_BASE = "https://sepolia.voyager.online";

function useLiveBtcPrice(fallback: number) {
  const [price, setPrice] = useState(fallback);
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const data = await res.json();
        if (data.bitcoin?.usd) setPrice(data.bitcoin.usd);
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
const LIQUIDATION_RATIO = 110; // HF < 1.0 = liquidation

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
  if (hf >= 2.0) return "text-green-400";
  if (hf >= 1.5) return "text-accent-400";
  if (hf >= 1.3) return "text-orange-400";
  return "text-red-400";
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
  if (hf >= 2.0) return "bg-green-500";
  if (hf >= 1.5) return "bg-accent-500";
  if (hf >= 1.3) return "bg-orange-500";
  return "bg-red-500";
}

export default function MintPage() {
  const { address, account, isConnected } = useAccount();
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

  // Fetch WBTC balance
  useEffect(() => {
    if (!address || !isConnected || CONTRACT_ADDRESSES.mockWbtc === "0x0") return;
    const provider = new RpcProvider({ nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo" });
    const wbtc = new Contract({ abi: ABIS.erc20, address: CONTRACT_ADDRESSES.mockWbtc, providerOrAccount: provider });
    wbtc.balance_of(address).then((bal: bigint) => {
      const formatted = Number(bal) / 10 ** WBTC_DECIMALS;
      setWbtcBalance(formatted.toFixed(WBTC_DECIMALS));
    }).catch(() => {});
  }, [address, isConnected, txHash]);

  // Fetch protocol stats
  useEffect(() => {
    if (CONTRACT_ADDRESSES.cdpManager === "0x0") return;
    const provider = new RpcProvider({ nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo" });
    const cdp = new Contract({ abi: ABIS.cdpManager, address: CONTRACT_ADDRESSES.cdpManager, providerOrAccount: provider });
    cdp.get_total_debt().then((d: bigint) => {
      setTotalDebt((Number(d) / 10 ** MOONUSD_DECIMALS).toLocaleString("en-US", { maximumFractionDigits: 2 }));
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
    // 80% LTV means max borrow = collateral_value * 0.8
    return collateralValue * 0.8;
  }, [collateralValue]);

  const collateralRatio = useMemo(() => {
    const borrow = parseFloat(borrowAmount) || 0;
    if (borrow === 0) return 0;
    return (collateralValue / borrow) * 100;
  }, [collateralValue, borrowAmount]);

  const healthFactor = useMemo(() => {
    const borrow = parseFloat(borrowAmount) || 0;
    if (borrow === 0) return 0;
    // HF = collateral_value * ltv_max / (BPS * debt) simplified:
    // HF = collateral_value * 0.8 / debt
    return (collateralValue * 0.8) / borrow;
  }, [collateralValue, borrowAmount]);

  const liquidationPrice = useMemo(() => {
    const borrow = parseFloat(borrowAmount) || 0;
    const collateral = parseFloat(collateralAmount) || 0;
    if (collateral === 0) return 0;
    // Liquidation when HF <= 1: collateral * price * 0.8 / debt = 1
    // price = debt / (collateral * 0.8)
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
    if (!address || !account || !isValidPosition) return;
    setMinting(true);
    setError("");
    setTxHash("");

    try {
      const collateral = parseFloat(collateralAmount);
      const borrow = parseFloat(borrowAmount);
      const rateBps = INTEREST_RATES[selectedRate].value;

      // Convert to contract units
      const collateralSats = BigInt(Math.round(collateral * 10 ** WBTC_DECIMALS));
      const mintWei = BigInt(Math.round(borrow * 10 ** MOONUSD_DECIMALS));
      const rateBigInt = BigInt(rateBps);

      // Build approve + open_position multicall
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

      const result = await account.execute([approveCall, openCall]);
      setTxHash(result.transaction_hash);
    } catch (e: any) {
      console.error("Mint failed:", e);
      setError(e?.message?.slice(0, 300) || "Transaction failed");
    } finally {
      setMinting(false);
    }
  }, [address, account, collateralAmount, borrowAmount, selectedRate, isValidPosition]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-dark-50 mb-2">
          Mint moonUSD
        </h1>
        <p className="text-dark-400">
          Deposit WBTC as collateral to mint moonUSD stablecoin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Collateral Input */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-dark-100">
                Collateral
              </h2>
              <span className="text-xs text-dark-500">
                Balance: {wbtcBalance} WBTC
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center bg-dark-900/50 rounded-xl border border-dark-600/50 focus-within:border-primary-500/50 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
                <input
                  type="number"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent px-4 py-4 text-xl font-medium text-dark-50 placeholder:text-dark-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center space-x-2 px-4">
                  <div className="w-6 h-6 rounded-full bg-accent-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-accent-400">
                      B
                    </span>
                  </div>
                  <span className="text-sm font-medium text-dark-300">
                    WBTC
                  </span>
                </div>
              </div>
              {collateralValue > 0 && (
                <p className="text-xs text-dark-500 mt-2 px-1">
                  ~${collateralValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex items-center space-x-2 mt-3">
              {["0.01", "0.1", "0.5", "1.0"].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setCollateralAmount(amount)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-dark-400 bg-dark-700/50 border border-dark-600/30 hover:border-primary-500/30 hover:text-dark-200 transition-all"
                >
                  {amount}
                </button>
              ))}
              <button
                onClick={() => setCollateralAmount(wbtcBalance)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-dark-400 bg-dark-700/50 border border-dark-600/30 hover:border-primary-500/30 hover:text-dark-200 transition-all"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Arrow Separator */}
          <div className="flex justify-center -my-2">
            <div className="w-10 h-10 rounded-xl bg-dark-800 border border-dark-700/50 flex items-center justify-center">
              <ArrowsRightLeftIcon className="w-4 h-4 text-dark-400 rotate-90" />
            </div>
          </div>

          {/* Borrow Output */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-dark-100">
                Borrow
              </h2>
              <span className="text-xs text-dark-500">
                Max: {maxBorrow > 0 ? maxBorrow.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0.00"} moonUSD
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center bg-dark-900/50 rounded-xl border border-dark-600/50 focus-within:border-primary-500/50 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
                <input
                  type="number"
                  value={borrowAmount}
                  onChange={(e) => setBorrowAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent px-4 py-4 text-xl font-medium text-dark-50 placeholder:text-dark-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center space-x-2 px-4">
                  <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center">
                    <CurrencyDollarIcon className="w-3.5 h-3.5 text-primary-400" />
                  </div>
                  <span className="text-sm font-medium text-dark-300">
                    moonUSD
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Percentage Buttons */}
            <div className="flex items-center space-x-2 mt-3">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const val = (maxBorrow * pct) / 100;
                    setBorrowAmount(val > 0 ? val.toFixed(2) : "");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-dark-400 bg-dark-700/50 border border-dark-600/30 hover:border-primary-500/30 hover:text-dark-200 transition-all"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Interest Rate Selector */}
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <h2 className="text-lg font-semibold text-dark-100">
                Interest Rate
              </h2>
              <div className="group relative">
                <InformationCircleIcon className="w-4 h-4 text-dark-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-dark-700 border border-dark-600/50 text-xs text-dark-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Choose your annual interest rate. Lower rates are cheaper but
                  positions are redeemed first during redemptions.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {INTEREST_RATES.map((rate, i) => (
                <button
                  key={rate.value}
                  onClick={() => setSelectedRate(i)}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                    selectedRate === i
                      ? "bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/20"
                      : "bg-dark-800/50 border-dark-600/30 hover:border-dark-500/50"
                  }`}
                >
                  <p
                    className={`text-lg font-bold mb-0.5 ${
                      selectedRate === i ? "text-primary-400" : "text-dark-200"
                    }`}
                  >
                    {rate.label}
                  </p>
                  <p className="text-[10px] text-dark-500 leading-tight">
                    {rate.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Validation Warnings */}
          {parseFloat(borrowAmount) > 0 && parseFloat(borrowAmount) < MIN_DEBT_MOONUSD && (
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  Below minimum debt
                </p>
                <p className="text-xs text-red-400/70 mt-0.5">
                  Minimum borrow is {MIN_DEBT_MOONUSD} moonUSD.
                </p>
              </div>
            </div>
          )}

          {parseFloat(borrowAmount) >= MIN_DEBT_MOONUSD &&
            collateralRatio > 0 &&
            collateralRatio < MIN_COLLATERAL_RATIO && (
              <div className="flex items-start space-x-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Insufficient collateral
                  </p>
                  <p className="text-xs text-red-400/70 mt-0.5">
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
            className="btn-primary w-full text-base py-4"
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
          {txHash && (
            <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
                <p className="text-sm font-semibold text-green-400">
                  Position opened successfully!
                </p>
              </div>
              <p className="text-xs text-dark-400 mb-2">
                You deposited {collateralAmount} WBTC and minted {parseFloat(borrowAmount).toLocaleString()} moonUSD.
              </p>
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
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300 break-all">{error}</p>
              </div>
            </div>
          )}

          {isValidPosition && !txHash && (
            <div className="flex items-center justify-center space-x-2 text-xs text-dark-500">
              <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />
              <span>
                You will deposit {collateralAmount} WBTC and receive{" "}
                {parseFloat(borrowAmount).toLocaleString()} moonUSD
              </span>
            </div>
          )}
        </div>

        {/* Right Sidebar - Position Details */}
        <div className="space-y-6">
          {/* Health Factor Card */}
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-4">
              Health Factor
            </h3>

            <div className="text-center mb-4">
              <p
                className={`text-4xl font-bold ${
                  healthFactor > 0
                    ? getHealthFactorColor(healthFactor)
                    : "text-dark-600"
                }`}
              >
                {healthFactor > 0 ? healthFactor.toFixed(2) : "--"}
              </p>
              <p
                className={`text-sm mt-1 ${
                  healthFactor > 0
                    ? getHealthFactorColor(healthFactor)
                    : "text-dark-600"
                }`}
              >
                {healthFactor > 0 ? getHealthFactorLabel(healthFactor) : "No position"}
              </p>
            </div>

            {/* Health Factor Bar */}
            <div className="w-full h-2 rounded-full bg-dark-700 overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  healthFactor > 0
                    ? getHealthFactorBarColor(healthFactor)
                    : "bg-dark-700"
                }`}
                style={{ width: getHealthFactorBarWidth(healthFactor) }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-dark-500">
              <span>Liquidation</span>
              <span>Safe</span>
            </div>
          </div>

          {/* Position Summary */}
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-4">
              Position Summary
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  Collateral Value
                </span>
                <span className="text-sm font-medium text-dark-200">
                  ${collateralValue > 0 ? collateralValue.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0.00"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">Borrow Amount</span>
                <span className="text-sm font-medium text-dark-200">
                  {parseFloat(borrowAmount) > 0
                    ? `${parseFloat(borrowAmount).toLocaleString()} moonUSD`
                    : "0.00 moonUSD"}
                </span>
              </div>
              <div className="h-px bg-dark-700/50" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  Collateral Ratio
                </span>
                <span
                  className={`text-sm font-medium ${
                    collateralRatio >= MIN_COLLATERAL_RATIO
                      ? "text-green-400"
                      : collateralRatio > 0
                        ? "text-red-400"
                        : "text-dark-500"
                  }`}
                >
                  {collateralRatio > 0 ? `${collateralRatio.toFixed(1)}%` : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  Liquidation Price
                </span>
                <span className="text-sm font-medium text-dark-200">
                  {liquidationPrice > 0
                    ? `$${liquidationPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">Interest Rate</span>
                <span className="text-sm font-medium text-dark-200">
                  {INTEREST_RATES[selectedRate].label} APR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  Max LTV
                </span>
                <span className="text-sm font-medium text-dark-500">
                  80%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  Min. Debt
                </span>
                <span className="text-sm font-medium text-dark-500">
                  {MIN_DEBT_MOONUSD} moonUSD
                </span>
              </div>
            </div>
          </div>

          {/* Protocol Stats */}
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-4">
              Protocol Stats
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  BTC Price
                </span>
                <span className="text-sm font-medium text-dark-200">
                  ${BTC_PRICE.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  Total Debt
                </span>
                <span className="text-sm font-medium text-dark-200">
                  {totalDebt} moonUSD
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-dark-400">
                  Active Positions
                </span>
                <span className="text-sm font-medium text-dark-200">
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
