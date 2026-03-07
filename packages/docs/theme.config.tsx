import { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <path d="M60 15 A40 40 0 1 0 60 85 A28 28 0 1 1 60 15Z" fill="currentColor" />
      </svg>
      <span style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.05em" }}>
        MOONIGHT
      </span>
    </span>
  ),
  project: {
    link: "https://github.com/kunal-drall/moonightv0",
  },
  chat: {
    link: "https://discord.gg/cZa7YpyQ",
  },
  docsRepositoryBase:
    "https://github.com/kunal-drall/moonightv0/tree/main/packages/docs",
  footer: {
    content: (
      <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", opacity: 0.6 }}>
        <svg width="14" height="14" viewBox="0 0 100 100" fill="none">
          <path d="M60 15 A40 40 0 1 0 60 85 A28 28 0 1 1 60 15Z" fill="currentColor" />
        </svg>
        {new Date().getFullYear()} Moonight Protocol. Built on Starknet.
      </span>
    ),
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Moonight Protocol Documentation - BTC-backed stablecoin on Starknet" />
      <meta property="og:title" content="Moonight Docs" />
      <meta property="og:description" content="Documentation for the Moonight Protocol - BTC-backed stablecoin on Starknet" />
      <meta name="theme-color" content="#0a0c10" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 2,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
  },
  color: {
    hue: 38,
    saturation: 92,
  },
  banner: {
    key: "sepolia-live",
    content: (
      <a href="https://sepolia.moonight.fun" target="_blank" rel="noopener noreferrer">
        Moonight is live on Starknet Sepolia testnet. Try it out &rarr;
      </a>
    ),
  },
};

export default config;
