import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vaults",
  description:
    "Earn yield on your Bitcoin with Moonight delta-neutral vaults. Conservative (4-8% APY) and aggressive (15-30% APY) strategies powered by Starknet smart contracts.",
  openGraph: {
    title: "BTC Yield Vaults | Moonight Protocol",
    description:
      "Delta-neutral BTC vaults on Starknet. Conservative and aggressive yield strategies with auto-compounding.",
  },
};

export default function VaultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
