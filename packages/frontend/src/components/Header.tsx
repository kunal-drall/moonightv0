"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Bars3Icon, XMarkIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import ConnectWallet from "./ConnectWallet";

const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";

const navLinks = [
  { name: "Dashboard", href: "/" },
  { name: "Mint", href: "/mint" },
  { name: "Vaults", href: "/vaults" },
  { name: "Card", href: "/card" },
  ...(!isMainnet ? [{ name: "Faucet", href: "/faucet" }] : []),
];

function MoonLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-76 -76 152 152"
      className={className}
      fill="currentColor"
    >
      <circle cx="0" cy="0" r="72" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <clipPath id="hdr-moon">
        <circle cx="0" cy="0" r="72" />
      </clipPath>
      <circle cx="22" cy="0" r="62" fill="currentColor" clipPath="url(#hdr-moon)" />
      <circle cx="-34" cy="-25" r="3.5" fill="currentColor" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    try {
      setPrivacyMode(localStorage.getItem("moonight-privacy") === "true");
    } catch { /* storage unavailable */ }
  }, []);

  const togglePrivacy = () => {
    const next = !privacyMode;
    setPrivacyMode(next);
    try {
      localStorage.setItem("moonight-privacy", String(next));
    } catch { /* storage unavailable */ }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/30 bg-surface-0/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[52px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="text-text-0 animate-moon-glow">
              <MoonLogo className="w-6 h-6" />
            </div>
            <span className="text-xs font-display font-light tracking-[0.25em] uppercase text-text-0 hidden sm:block">
              Moonight
            </span>
            {isMainnet ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-accent font-display tracking-wider uppercase">
                <span className="w-1 h-1 rounded-full bg-accent" />
                Beta
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-text-2 font-display tracking-wider uppercase">
                <span className="w-1 h-1 rounded-full bg-text-2" />
                Testnet
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-display transition-all duration-200 ${
                    isActive
                      ? "text-text-0 border-b border-accent"
                      : "text-text-2 hover:text-text-1"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Privacy Mode Toggle */}
            <button
              onClick={togglePrivacy}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider font-display border transition-all duration-200 ${
                privacyMode
                  ? "text-success bg-success/5 border-success/20 hover:bg-success/10"
                  : "text-text-2 bg-transparent border-border/50 hover:text-text-1 hover:border-border"
              }`}
              title={privacyMode ? "Privacy: Enhanced (powered by S-two)" : "Enable privacy mode"}
            >
              <ShieldCheckIcon className="w-3 h-3" />
              {privacyMode ? "Private" : "Privacy"}
            </button>

            {/* Network switcher */}
            <a
              href={isMainnet ? "https://sepolia.moonight.fun" : "https://app.moonight.fun"}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider font-display text-text-2 border border-border/50 hover:text-text-1 hover:border-border transition-all duration-200"
            >
              <span className={`w-1 h-1 rounded-full ${isMainnet ? "bg-accent" : "bg-success"}`} />
              {isMainnet ? "Mainnet" : "Sepolia"}
            </a>

            <ConnectWallet />

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-text-2 hover:text-text-0 transition-colors"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="w-5 h-5" />
              ) : (
                <Bars3Icon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border/30 animate-fade-up">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2.5 text-xs uppercase tracking-[0.12em] font-display transition-all duration-200 ${
                      isActive
                        ? "text-text-0 border-l-2 border-accent"
                        : "text-text-2 hover:text-text-1"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
              <div className="pt-2 mt-2 border-t border-border/30">
                <a
                  href={isMainnet ? "https://sepolia.moonight.fun" : "https://app.moonight.fun"}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-text-2 hover:text-text-1 font-display uppercase tracking-wider"
                >
                  <span className={`w-1 h-1 rounded-full ${isMainnet ? "bg-success" : "bg-accent"}`} />
                  Switch to {isMainnet ? "Sepolia" : "Mainnet"}
                </a>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
