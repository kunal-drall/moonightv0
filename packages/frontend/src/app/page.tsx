"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Contract, RpcProvider } from "starknet";
import { ABIS, CONTRACT_ADDRESSES } from "@/hooks/useMoonightContracts";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo";

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

function useBtcPrice() {
  const [price, setPrice] = useState<string>("--");
  const [change, setChange] = useState<{ value: string; positive: boolean }>({
    value: "--",
    positive: true,
  });

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
        );
        if (!res.ok) return;
        const data = await res.json();
        const btcPrice = Number(data?.bitcoin?.usd);
        const btcChange = Number(data?.bitcoin?.usd_24h_change);
        if (isNaN(btcPrice) || !isFinite(btcPrice) || btcPrice <= 0) return;
        setPrice(
          `$${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
        );
        if (!isNaN(btcChange) && isFinite(btcChange)) {
          setChange({
            value: `${btcChange >= 0 ? "+" : ""}${btcChange.toFixed(1)}%`,
            positive: btcChange >= 0,
          });
        }
      } catch {
        setPrice("--");
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { price, change };
}

function useProtocolStats() {
  const [totalDebt, setTotalDebt] = useState("0");
  const [moonusdSupply, setMoonusdSupply] = useState("0");
  const [activePositions, setActivePositions] = useState("0");

  useEffect(() => {
    if (CONTRACT_ADDRESSES.cdpManager === "0x0") return;
    const provider = new RpcProvider({ nodeUrl: RPC_URL });

    const cdp = new Contract({ abi: ABIS.cdpManager, address: CONTRACT_ADDRESSES.cdpManager, providerOrAccount: provider });
    cdp.get_total_debt().then((d: bigint) => {
      const formatted = formatBigInt(d, 18);
      const num = parseFloat(formatted.replace(/,/g, ""));
      setTotalDebt(num > 1000 ? `${(num / 1000).toFixed(1)}K` : formatted);
    }).catch(() => {});
    cdp.get_active_positions().then((n: bigint) => {
      setActivePositions(Number(n).toString());
    }).catch(() => {});

    const moonusd = new Contract({ abi: ABIS.erc20, address: CONTRACT_ADDRESSES.moonUSD, providerOrAccount: provider });
    moonusd.total_supply().then((s: bigint) => {
      const formatted = formatBigInt(s, 18);
      const num = parseFloat(formatted.replace(/,/g, ""));
      setMoonusdSupply(num > 1000 ? `${(num / 1000).toFixed(1)}K` : formatted);
    }).catch(() => {});
  }, []);

  return { totalDebt, moonusdSupply, activePositions };
}

const quickActions = [
  {
    title: "Mint moonUSD",
    description: "Deposit WBTC as collateral and mint moonUSD stablecoin.",
    href: "/mint",
    tag: "Core",
  },
  {
    title: "Delta-Neutral Vault",
    description: "Earn stable yield through hedged BTC strategies. 5-12% APY target.",
    href: "/vaults",
    tag: "Low Risk",
  },
  {
    title: "Yield Optimizer",
    description: "Maximize returns through curated DeFi yield aggregation.",
    href: "/vaults",
    tag: "Variable",
  },
];

const features = [
  {
    title: "BTC-Backed Stability",
    description: "moonUSD is fully backed by Bitcoin collateral with robust liquidation mechanisms.",
  },
  {
    title: "Cairo Smart Contracts",
    description: "Built on Starknet with Cairo, leveraging STARK proofs for security and scalability.",
  },
  {
    title: "Multi-Vault Architecture",
    description: "Delta-neutral hedging or yield optimization — choose your risk profile.",
  },
  {
    title: "DeFi Payment Card",
    description: "Spend moonUSD anywhere with virtual and physical debit card integration.",
  },
];

export default function HomePage() {
  const btc = useBtcPrice();
  const { totalDebt, moonusdSupply, activePositions } = useProtocolStats();

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 items-start">
            {/* Left: Stats */}
            <div>
              {/* Network indicator */}
              <div className="flex items-center gap-2 mb-10" data-animate="0">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
                <span className="text-xs text-text-2 font-display tracking-wider uppercase">
                  Live on Starknet Sepolia
                </span>
              </div>

              {/* Protocol stats as large numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12" data-animate="1">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-2">
                    Total Debt
                  </p>
                  <p className="text-3xl sm:text-4xl font-mono font-semibold text-text-0 tracking-tight">
                    {totalDebt}
                  </p>
                  <p className="text-xs text-text-2 mt-1 font-mono">
                    {activePositions} active positions
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-2">
                    BTC Price
                  </p>
                  <p className="text-3xl sm:text-4xl font-mono font-semibold text-text-0 tracking-tight">
                    {btc.price}
                  </p>
                  <p className={`text-xs font-mono mt-1 ${btc.change.positive ? "text-success" : "text-danger"}`}>
                    {btc.change.value}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-text-2 font-display mb-2">
                    moonUSD Supply
                  </p>
                  <p className="text-3xl sm:text-4xl font-mono font-semibold text-text-0 tracking-tight">
                    {moonusdSupply}
                  </p>
                  <p className="text-xs text-text-2 mt-1">
                    Circulating supply
                  </p>
                </div>
              </div>

              {/* Quick links */}
              <div className="flex flex-wrap items-center gap-6 mt-10" data-animate="2">
                <Link
                  href="/mint"
                  className="text-sm text-text-1 hover:text-accent font-display tracking-wide transition-colors duration-200 flex items-center gap-1.5 group"
                >
                  Mint moonUSD
                  <ArrowRightIcon className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/vaults"
                  className="text-sm text-text-1 hover:text-accent font-display tracking-wide transition-colors duration-200 flex items-center gap-1.5 group"
                >
                  Explore Vaults
                  <ArrowRightIcon className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/faucet"
                  className="text-sm text-text-1 hover:text-accent font-display tracking-wide transition-colors duration-200 flex items-center gap-1.5 group"
                >
                  Get Test WBTC
                  <ArrowRightIcon className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Right: Moon SVG */}
            <div className="hidden lg:block" data-animate="3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="-76 -76 152 152"
                className="w-48 h-48 text-text-0 animate-moon-glow opacity-20"
                fill="currentColor"
              >
                <circle cx="0" cy="0" r="72" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <clipPath id="hero-moon">
                  <circle cx="0" cy="0" r="72" />
                </clipPath>
                <circle cx="22" cy="0" r="62" fill="currentColor" clipPath="url(#hero-moon)" />
                <circle cx="-34" cy="-25" r="3.5" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="border-t border-border/30 pt-12">
          {quickActions.map((action, i) => (
            <Link
              key={action.title}
              href={action.href}
              className="group flex items-center justify-between py-5 border-b border-border/20 hover:border-border/50 transition-all duration-300"
              data-animate={String(i + 4)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-display text-text-0 group-hover:text-accent transition-colors duration-200">
                  {action.title}
                </h3>
                <p className="text-sm text-text-2 mt-0.5">
                  {action.description}
                </p>
              </div>
              <div className="flex items-center gap-4 ml-6 shrink-0">
                <span className="text-[10px] text-text-2 font-mono uppercase tracking-wider hidden sm:block">
                  {action.tag}
                </span>
                <ArrowRightIcon className="w-4 h-4 text-text-2 group-hover:text-accent group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 border-t border-border/30 pt-12">
          {features.map((feature, i) => (
            <div key={i}>
              <h3 className="text-sm font-display text-text-0 mb-2">
                {feature.title}
              </h3>
              <p className="text-xs text-text-2 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="border-t border-border/30 pt-12 text-center">
          <p className="text-text-2 text-sm mb-4">
            Ready to unlock your Bitcoin?
          </p>
          <Link href="/mint" className="btn-primary text-sm px-8 py-3">
            Launch App
            <ArrowRightIcon className="w-3.5 h-3.5 ml-2" />
          </Link>
        </div>
      </section>
    </div>
  );
}
