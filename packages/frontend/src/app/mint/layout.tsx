import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mint moonUSD",
  description:
    "Mint moonUSD stablecoin by depositing BTC (WBTC) as collateral. Set your own interest rate, manage your collateralized debt position, and borrow against Bitcoin on Starknet.",
  openGraph: {
    title: "Mint moonUSD | Moonight Protocol",
    description:
      "Deposit BTC to mint moonUSD stablecoin on Starknet. Up to 80% LTV with user-set interest rates.",
  },
};

export default function MintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
