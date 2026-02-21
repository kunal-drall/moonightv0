import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StarknetProvider from "@/providers/StarknetProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Moonight Protocol | BTC-Backed Stablecoin on Starknet",
  description:
    "Mint moonUSD, the BTC-backed stablecoin on Starknet. Access delta-neutral vaults, yield strategies, and DeFi-native payment cards.",
  keywords: [
    "Moonight",
    "moonUSD",
    "stablecoin",
    "Bitcoin",
    "BTC",
    "Starknet",
    "DeFi",
    "vault",
    "yield",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} min-h-screen bg-dark-900 text-dark-50`}
      >
        <StarknetProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </StarknetProvider>
      </body>
    </html>
  );
}
