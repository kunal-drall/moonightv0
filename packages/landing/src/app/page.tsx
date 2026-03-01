"use client";

import { useState } from "react";

const stats = [
  { label: "Total Value Locked", value: "$0", suffix: "" },
  { label: "moonUSD Minted", value: "0", suffix: "" },
  { label: "Active Vaults", value: "4", suffix: "" },
  { label: "Avg Vault APY", value: "—", suffix: "%" },
];

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.893 13.393l-1.135-1.135a2.252 2.252 0 01-.421-.585l-1.08-2.16a.414.414 0 00-.663-.107.827.827 0 01-.812.21l-1.273-.363a.89.89 0 00-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 01-1.81 1.025 1.055 1.055 0 01-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 01-1.383-2.46l.007-.042a2.25 2.25 0 01.29-.787l.09-.15a2.25 2.25 0 012.37-1.048l1.178.236a1.125 1.125 0 001.302-.795l.208-.73a1.125 1.125 0 00-.578-1.315l-.665-.332-.091.091a2.25 2.25 0 01-1.591.659h-.18c-.249 0-.487.1-.662.274a.931.931 0 01-1.458-1.137l1.411-2.353a2.25 2.25 0 00.286-.76M11.5 2.25A9.25 9.25 0 1020.75 11.5 9.25 9.25 0 0011.5 2.25z" />
      </svg>
    ),
    title: "BTC-Backed Stability",
    description:
      "Mint moonUSD stablecoin backed by Bitcoin collateral. Overcollateralized CDPs with dynamic interest rates ensure 1:1 peg stability.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-7.5 3 7.5" />
      </svg>
    ),
    title: "Delta-Neutral Vaults",
    description:
      "Earn 5-12% APY with zero directional risk. Vault A harvests perpetual funding rates through automated hedging strategies.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: "Yield Optimizer",
    description:
      "Vault C auto-compounds moonUSD across the Stability Pool, Ekubo LP, and lending protocols. Softmax allocation maximizes risk-adjusted returns.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    title: "DeFi Debit Card",
    description:
      "Spend your moonUSD anywhere Visa is accepted. Auto top-up from vault yields. Powered by Rain.xyz with instant card issuance.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Cairo Smart Contracts",
    description:
      "Provable execution on Starknet. STARK proofs guarantee computational integrity. Lower gas, higher throughput, cryptographic security.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: "Instant Redemptions",
    description:
      "Redeem moonUSD for BTC collateral at any time. Sorted queue ensures lowest-rate positions are redeemed first. Decaying base rate prevents arbitrage abuse.",
  },
];

const steps = [
  {
    step: "01",
    title: "Connect Wallet",
    description:
      "Connect your ArgentX or Braavos wallet to the Moonight app on Starknet.",
  },
  {
    step: "02",
    title: "Deposit BTC Collateral",
    description:
      "Deposit WBTC as collateral and set your interest rate tier. Choose your leverage level.",
  },
  {
    step: "03",
    title: "Mint moonUSD",
    description:
      "Borrow moonUSD against your BTC at up to 66% LTV. Your position is represented as an NFT.",
  },
  {
    step: "04",
    title: "Earn & Spend",
    description:
      "Deposit moonUSD into vaults for yield, or load your card and spend anywhere Visa is accepted.",
  },
];

const vaultCards = [
  {
    name: "Vault A",
    subtitle: "Delta-Neutral",
    apy: "5-12%",
    risk: "Low",
    riskColor: "text-green-400 bg-green-400/10",
    description:
      "Harvest perpetual funding rates with automated BTC spot + short perp hedging. Zero directional exposure.",
    tags: ["Funding Rate", "Auto-Rebalance", "No IL"],
  },
  {
    name: "Vault C",
    subtitle: "Yield Optimizer",
    apy: "8-25%",
    risk: "Medium",
    riskColor: "text-accent-400 bg-accent-400/10",
    description:
      "Multi-strategy moonUSD allocation across Stability Pool, DEX liquidity, and lending. Auto-compounding.",
    tags: ["Diversified", "Auto-Compound", "ERC-4626"],
  },
  {
    name: "Vault B",
    subtitle: "Leveraged Yield",
    apy: "TBD",
    risk: "High",
    riskColor: "text-red-400 bg-red-400/10",
    description:
      "Amplified returns through leveraged strategies on BTC collateral positions. Coming soon.",
    tags: ["Leveraged", "Advanced", "Coming Soon"],
  },
  {
    name: "Vault D",
    subtitle: "LP Farming",
    apy: "TBD",
    risk: "Medium",
    riskColor: "text-accent-400 bg-accent-400/10",
    description:
      "Concentrated liquidity provision for moonUSD/USDC on Ekubo DEX. Coming soon.",
    tags: ["LP", "Ekubo", "Coming Soon"],
  },
];

export default function LandingPage() {
  const [launchOpen, setLaunchOpen] = useState(false);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-500/8 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-800/5 rounded-full blur-[150px]" />
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-600/10 border border-primary-500/20 rounded-full mb-8 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            <span className="text-sm text-primary-300">
              Now live on Starknet Sepolia Testnet
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            Unlock Your Bitcoin.
            <br />
            <span className="gradient-text">Earn. Spend. Repeat.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-dark-300 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Mint moonUSD against your BTC collateral. Earn yield through delta-neutral vaults.
            Spend anywhere with a virtual debit card. All on Starknet.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="relative">
              <button
                onClick={() => setLaunchOpen(!launchOpen)}
                className="px-8 py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-500 hover:to-primary-400 transition-all duration-200 shadow-lg shadow-primary-600/25 flex items-center gap-2"
              >
                Launch App
                <svg
                  className={`w-4 h-4 transition-transform ${launchOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {launchOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
                  <a
                    href="https://sepolia.moonight.fun"
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-dark-700/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary-600/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">Sepolia Testnet</div>
                      <div className="text-xs text-dark-400">Test with fake assets</div>
                    </div>
                    <span className="ml-auto text-[10px] font-medium text-primary-400 bg-primary-400/10 px-2 py-0.5 rounded-full">
                      LIVE
                    </span>
                  </a>
                  <div className="border-t border-dark-700/50" />
                  <a
                    href="https://app.moonight.fun"
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-dark-700/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-accent-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white flex items-center gap-1.5">
                        Mainnet
                        <span className="text-[10px] font-semibold text-accent-400 bg-accent-400/10 px-1.5 py-0.5 rounded">BETA</span>
                      </div>
                      <div className="text-xs text-dark-400">Real assets on Starknet</div>
                    </div>
                    <span className="ml-auto text-[10px] font-medium text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full">
                      SOON
                    </span>
                  </a>
                </div>
              )}
            </div>
            <a
              href="https://docs.moonight.fun"
              className="px-8 py-3.5 border border-dark-600 text-dark-200 font-semibold rounded-xl hover:bg-dark-800 hover:border-dark-500 transition-all duration-200"
            >
              Read Docs
            </a>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {stat.value}
                  {stat.suffix && <span className="text-dark-400 text-lg">{stat.suffix}</span>}
                </div>
                <div className="text-sm text-dark-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need in <span className="gradient-text">One Protocol</span>
            </h2>
            <p className="text-dark-400 max-w-2xl mx-auto">
              From minting stablecoins to earning yield to spending with a card —
              Moonight is the complete BTC-backed DeFi stack.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group p-6 bg-dark-800/50 border border-dark-700/50 rounded-2xl hover:border-primary-500/30 hover:bg-dark-800/80 transition-all duration-300"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary-600/10 flex items-center justify-center text-primary-400 mb-4 group-hover:bg-primary-600/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-dark-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 relative bg-dark-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How <span className="gradient-text">Moonight</span> Works
            </h2>
            <p className="text-dark-400 max-w-xl mx-auto">
              Four simple steps to unlock the power of your Bitcoin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {steps.map((item, i) => (
              <div
                key={item.step}
                className="relative flex gap-5 p-6 bg-dark-800/30 border border-dark-700/30 rounded-2xl hover:border-primary-500/20 transition-all duration-300"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-sm text-dark-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vaults Section */}
      <section id="vaults" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Multi-Vault <span className="gradient-text">Architecture</span>
            </h2>
            <p className="text-dark-400 max-w-2xl mx-auto">
              Choose your risk/reward profile. From delta-neutral to leveraged,
              Moonight vaults automate complex DeFi strategies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vaultCards.map((vault) => (
              <div
                key={vault.name}
                className="p-6 bg-dark-800/50 border border-dark-700/50 rounded-2xl hover:border-primary-500/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{vault.name}</h3>
                    <p className="text-sm text-dark-400">{vault.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">{vault.apy}</div>
                    <div className="text-xs text-dark-400">APY Range</div>
                  </div>
                </div>
                <p className="text-sm text-dark-400 mb-4 leading-relaxed">
                  {vault.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {vault.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2.5 py-1 bg-dark-700/50 text-dark-300 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${vault.riskColor}`}>
                    {vault.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-primary-600/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[250px] bg-accent-500/8 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Unlock Your <span className="gradient-text">Bitcoin</span>?
          </h2>
          <p className="text-dark-400 mb-8 max-w-lg mx-auto">
            Join the next generation of BTC-backed DeFi on Starknet.
            Start minting moonUSD and earning yield today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://sepolia.moonight.fun"
              className="px-8 py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-500 hover:to-primary-400 transition-all duration-200 shadow-lg shadow-primary-600/25"
            >
              Try on Testnet
            </a>
            <a
              href="https://docs.moonight.fun"
              className="px-8 py-3.5 border border-dark-600 text-dark-200 font-semibold rounded-xl hover:bg-dark-800 hover:border-dark-500 transition-all duration-200"
            >
              Read Documentation
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
