import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Testnet Faucet",
  description:
    "Get free test WBTC on Starknet Sepolia to try the Moonight Protocol. Mint test tokens to use as collateral for moonUSD.",
  openGraph: {
    title: "Testnet Faucet | Moonight Protocol",
    description:
      "Mint free test WBTC on Starknet Sepolia. Use as collateral to mint moonUSD in the Moonight Protocol testnet.",
  },
};

export default function FaucetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
