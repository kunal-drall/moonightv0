"use client";

import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLaunchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Vaults", href: "#vaults" },
    { label: "Docs", href: "https://docs.moonight.fun" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-dark-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            <span className="text-white font-semibold text-lg">Moonight</span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-dark-300 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Launch App button */}
          <div className="hidden md:flex items-center gap-3">
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setLaunchOpen(!launchOpen)}
                className="px-5 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-medium rounded-lg hover:from-primary-500 hover:to-primary-400 transition-all duration-200 flex items-center gap-2"
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
                <div className="absolute right-0 mt-2 w-64 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                  <a
                    href="https://sepolia.moonight.fun"
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-dark-700/50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary-600/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white group-hover:text-primary-300 transition-colors">
                        Sepolia Testnet
                      </div>
                      <div className="text-xs text-dark-400">
                        Test with fake assets
                      </div>
                    </div>
                    <span className="ml-auto text-[10px] font-medium text-primary-400 bg-primary-400/10 px-2 py-0.5 rounded-full">
                      LIVE
                    </span>
                  </a>
                  <div className="border-t border-dark-700/50" />
                  <a
                    href="https://app.moonight.fun"
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-dark-700/50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-accent-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white group-hover:text-accent-400 transition-colors flex items-center gap-1.5">
                        Mainnet
                        <span className="text-[10px] font-semibold text-accent-400 bg-accent-400/10 px-1.5 py-0.5 rounded">
                          BETA
                        </span>
                      </div>
                      <div className="text-xs text-dark-400">
                        Real assets on Starknet
                      </div>
                    </div>
                    <span className="ml-auto text-[10px] font-medium text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full">
                      SOON
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-dark-300 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-dark-700/50 bg-dark-950/95 backdrop-blur-xl animate-fade-in">
          <div className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 border-t border-dark-700/50 space-y-2">
              <a
                href="https://sepolia.moonight.fun"
                className="flex items-center justify-between px-3 py-2 text-sm text-white bg-primary-600/20 rounded-lg"
              >
                <span>Sepolia Testnet</span>
                <span className="text-[10px] font-medium text-primary-400 bg-primary-400/10 px-2 py-0.5 rounded-full">LIVE</span>
              </a>
              <a
                href="https://app.moonight.fun"
                className="flex items-center justify-between px-3 py-2 text-sm text-dark-400 bg-dark-800 rounded-lg"
              >
                <span>Mainnet Beta</span>
                <span className="text-[10px] font-medium text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full">SOON</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
