"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import ConnectWallet from "./ConnectWallet";

const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";

const navLinks = [
  { name: "Dashboard", href: "/" },
  { name: "Mint", href: "/mint" },
  { name: "Vaults", href: "/vaults" },
  { name: "Card", href: "/card" },
  ...(!isMainnet ? [{ name: "Faucet", href: "/faucet" }] : []),
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-dark-700/50 bg-dark-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 group-hover:from-primary-400 group-hover:to-accent-400 transition-all duration-300" />
              <div className="absolute inset-[3px] rounded-full bg-dark-900 flex items-center justify-center">
                <span className="text-xs font-bold gradient-text">M</span>
              </div>
            </div>
            <span className="text-lg font-bold text-dark-50 hidden sm:block">
              Moonight
            </span>
            {isMainnet ? (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-accent-500/10 border border-accent-500/20 text-[10px] font-semibold text-accent-400 uppercase tracking-wider">
                Beta
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/20 text-[10px] font-medium text-primary-400 uppercase tracking-wider">
                Testnet
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-dark-800 text-dark-50 shadow-sm"
                      : "text-dark-400 hover:text-dark-200 hover:bg-dark-800/50"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            {/* Network switcher link */}
            <a
              href={isMainnet ? "https://sepolia.moonight.fun" : "https://app.moonight.fun"}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-dark-400 hover:text-dark-200 bg-dark-800/50 rounded-lg border border-dark-700/50 hover:border-dark-600 transition-all"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isMainnet ? "bg-accent-400" : "bg-primary-400"}`} />
              {isMainnet ? "Mainnet" : "Sepolia"}
            </a>

            <ConnectWallet />

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800/50 transition-colors"
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
          <nav className="md:hidden py-4 border-t border-dark-700/50 animate-fade-in">
            <div className="flex flex-col space-y-1">
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-dark-800 text-dark-50"
                        : "text-dark-400 hover:text-dark-200 hover:bg-dark-800/50"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
              <div className="pt-2 border-t border-dark-700/50">
                <a
                  href={isMainnet ? "https://sepolia.moonight.fun" : "https://app.moonight.fun"}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-dark-400 hover:text-dark-200"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isMainnet ? "bg-primary-400" : "bg-accent-400"}`} />
                  Switch to {isMainnet ? "Sepolia Testnet" : "Mainnet Beta"}
                </a>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
