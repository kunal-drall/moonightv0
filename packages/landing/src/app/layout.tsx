import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Moonight Protocol - BTC-Backed Stablecoin on Starknet",
  description:
    "Unlock your Bitcoin. Mint moonUSD, earn yield through delta-neutral vaults, and spend anywhere with a virtual debit card. Built on Starknet with Cairo.",
  openGraph: {
    title: "Moonight Protocol",
    description: "BTC-backed stablecoin protocol on Starknet",
    url: "https://moonight.fun",
    siteName: "Moonight Protocol",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Moonight Protocol",
    description: "BTC-backed stablecoin protocol on Starknet",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
