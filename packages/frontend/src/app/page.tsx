"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  BoltIcon,
  ArrowRightIcon,
  CubeTransparentIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import StatsCard from "@/components/StatsCard";
import { Contract, RpcProvider } from "starknet";
import { ABIS, CONTRACT_ADDRESSES } from "@/hooks/useMoonightContracts";

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
        const data = await res.json();
        const btcPrice = data.bitcoin.usd;
        const btcChange = data.bitcoin.usd_24h_change;
        setPrice(
          `$${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
        );
        setChange({
          value: `${btcChange >= 0 ? "+" : ""}${btcChange.toFixed(1)}%`,
          positive: btcChange >= 0,
        });
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

const quickActions = [
  {
    title: "Mint moonUSD",
    description:
      "Deposit WBTC as collateral and mint moonUSD stablecoin. Minimum 150% collateral ratio required.",
    icon: <BanknotesIcon className="w-6 h-6" />,
    href: "/mint",
    gradient: "from-primary-500 to-primary-700",
    iconBg: "bg-primary-500/10 border-primary-500/20",
    tag: "Core",
  },
  {
    title: "Vault A: Delta-Neutral",
    description:
      "Earn stable yield through delta-neutral BTC strategies. Auto-hedged positions with protocol-managed risk.",
    icon: <ShieldCheckIcon className="w-6 h-6" />,
    href: "/vaults",
    gradient: "from-accent-500 to-accent-700",
    iconBg: "bg-accent-500/10 border-accent-500/20",
    tag: "Low Risk",
  },
  {
    title: "Vault C: Yield",
    description:
      "Maximize returns on your moonUSD through curated DeFi yield strategies. Higher risk, higher reward.",
    icon: <BoltIcon className="w-6 h-6" />,
    href: "/vaults",
    gradient: "from-green-500 to-emerald-700",
    iconBg: "bg-green-500/10 border-green-500/20",
    tag: "Variable APY",
  },
];

const features = [
  {
    title: "BTC-Backed Stability",
    description:
      "moonUSD is fully backed by Bitcoin collateral with robust liquidation mechanisms ensuring the peg.",
  },
  {
    title: "Cairo Smart Contracts",
    description:
      "Built on Starknet with Cairo, leveraging STARK proofs for unparalleled security and scalability.",
  },
  {
    title: "Multi-Vault Architecture",
    description:
      "Choose from delta-neutral hedging or yield optimization strategies based on your risk profile.",
  },
  {
    title: "DeFi Payment Card",
    description:
      "Spend your moonUSD anywhere with our upcoming virtual and physical debit card integration.",
  },
];

function useProtocolStats() {
  const [totalDebt, setTotalDebt] = useState("0");
  const [moonusdSupply, setMoonusdSupply] = useState("0");
  const [activePositions, setActivePositions] = useState("0");

  useEffect(() => {
    if (CONTRACT_ADDRESSES.cdpManager === "0x0") return;
    const provider = new RpcProvider({ nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo" });

    const cdp = new Contract({ abi: ABIS.cdpManager, address: CONTRACT_ADDRESSES.cdpManager, providerOrAccount: provider });
    cdp.get_total_debt().then((d: bigint) => {
      const val = Number(d) / 1e18;
      setTotalDebt(val > 1000 ? `${(val / 1000).toFixed(1)}K` : val.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    }).catch(() => {});
    cdp.get_active_positions().then((n: bigint) => {
      setActivePositions(Number(n).toString());
    }).catch(() => {});

    const moonusd = new Contract({ abi: ABIS.erc20, address: CONTRACT_ADDRESSES.moonUSD, providerOrAccount: provider });
    moonusd.total_supply().then((s: bigint) => {
      const val = Number(s) / 1e18;
      setMoonusdSupply(val > 1000 ? `${(val / 1000).toFixed(1)}K` : val.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    }).catch(() => {});
  }, []);

  return { totalDebt, moonusdSupply, activePositions };
}

export default function HomePage() {
  const btc = useBtcPrice();
  const { totalDebt, moonusdSupply, activePositions } = useProtocolStats();

  const stats = [
    {
      title: "Total Debt",
      value: `${totalDebt} moonUSD`,
      subtitle: `${activePositions} active positions`,
      change: { value: "--", positive: true },
      icon: <CubeTransparentIcon className="w-5 h-5 text-primary-400" />,
      accentColor: "primary" as const,
    },
    {
      title: "moonUSD Supply",
      value: moonusdSupply,
      subtitle: "Circulating supply",
      change: { value: "--", positive: true },
      icon: <CurrencyDollarIcon className="w-5 h-5 text-accent-400" />,
      accentColor: "accent" as const,
    },
    {
      title: "BTC Price",
      value: btc.price,
      subtitle: "CoinGecko live feed",
      change: btc.change,
      icon: <ChartBarIcon className="w-5 h-5 text-green-400" />,
      accentColor: "green" as const,
    },
  ];

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-hero-glow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-accent-500/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="text-center max-w-3xl mx-auto animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-sm text-primary-400 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mr-2 animate-pulse" />
              Live on Starknet Sepolia Testnet
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-dark-50">Moonight</span>
              <br />
              <span className="gradient-text">Protocol</span>
            </h1>

            {/* Tagline */}
            <p className="text-lg sm:text-xl text-dark-400 mb-4 max-w-2xl mx-auto text-balance">
              BTC-backed stablecoin on Starknet
            </p>
            <p className="text-base text-dark-500 mb-10 max-w-xl mx-auto">
              Mint moonUSD against your Bitcoin. Access delta-neutral vaults,
              yield strategies, and DeFi-native payments.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/mint" className="btn-primary text-base px-8 py-3.5">
                Start Minting
                <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Link>
              <Link
                href="/vaults"
                className="btn-secondary text-base px-8 py-3.5"
              >
                Explore Vaults
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {stats.map((stat) => (
            <StatsCard key={stat.title} {...stat} />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-dark-50 mb-3">
            Get Started
          </h2>
          <p className="text-dark-400 max-w-lg mx-auto">
            Choose your strategy. Mint stablecoins, hedge with delta-neutral
            positions, or maximize yield.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="card-hover group relative overflow-hidden"
            >
              {/* Top gradient bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />

              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl ${action.iconBg} border flex items-center justify-center`}
                >
                  <div className="text-dark-300 group-hover:text-dark-100 transition-colors">
                    {action.icon}
                  </div>
                </div>
                <span className="text-xs font-medium text-dark-500 bg-dark-700/50 px-2.5 py-1 rounded-md">
                  {action.tag}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-dark-100 mb-2 group-hover:text-dark-50 transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-dark-400 leading-relaxed mb-4">
                {action.description}
              </p>

              <div className="flex items-center text-sm text-primary-400 font-medium group-hover:text-primary-300 transition-colors">
                <span>Get started</span>
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="card group">
              <h3 className="text-base font-semibold text-dark-200 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-dark-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600/20 via-dark-800 to-accent-500/10 border border-dark-700/50 p-8 sm:p-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />

          <div className="relative text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-dark-50 mb-4">
              Ready to unlock your Bitcoin?
            </h2>
            <p className="text-dark-400 mb-8">
              Connect your wallet and start minting moonUSD in under a minute.
              No KYC required. Fully decentralized.
            </p>
            <Link href="/mint" className="btn-primary text-base px-8 py-3.5">
              Launch App
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
