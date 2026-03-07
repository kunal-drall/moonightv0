import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Card",
  description:
    "Spend moonUSD anywhere with the Moonight DeFi payment card. Virtual and physical debit cards with real-time on-chain settlement on Starknet.",
  openGraph: {
    title: "DeFi Payment Card | Moonight Protocol",
    description:
      "Spend your moonUSD stablecoin at any merchant with the Moonight DeFi payment card. Real-time settlement on Starknet.",
  },
};

export default function CardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
