import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = "https://moonight.fun";

export const metadata: Metadata = {
  title: {
    default: "Moonight Protocol | BTC-Backed Stablecoin on Starknet",
    template: "%s | Moonight Protocol",
  },
  description:
    "Moonight Protocol is a BTC-backed stablecoin (moonUSD) on Starknet. Mint moonUSD against your Bitcoin, access delta-neutral vaults, yield strategies, and DeFi-native payment cards. Built with Cairo smart contracts and STARK proofs.",
  keywords: [
    "Moonight", "Moonight Protocol", "moonUSD", "stablecoin", "Bitcoin",
    "BTC", "Starknet", "DeFi", "vault", "yield", "CDP", "collateral",
    "delta-neutral", "payment card", "Cairo", "STARK proofs", "BTC-backed",
    "strkBTC", "privacy", "zkKYC", "S-two", "BTC yield", "crypto stablecoin",
  ],
  authors: [{ name: "Moonight Protocol" }],
  creator: "Moonight Protocol",
  publisher: "Moonight Protocol",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Moonight Protocol",
    title: "Moonight Protocol | BTC-Backed Stablecoin on Starknet",
    description:
      "Unlock your Bitcoin. Mint moonUSD, earn yield through delta-neutral vaults, and spend anywhere with a DeFi payment card. Built on Starknet with Cairo smart contracts.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Moonight Protocol - BTC-Backed Stablecoin on Starknet",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moonight Protocol | BTC-Backed Stablecoin on Starknet",
    description:
      "Mint moonUSD against your Bitcoin on Starknet. Delta-neutral vaults, yield strategies, DeFi payment cards.",
    images: ["/og-image.png"],
    creator: "@0xmoonight",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Moonight Protocol",
    description: "BTC-backed stablecoin protocol on Starknet. Mint moonUSD against Bitcoin collateral with delta-neutral vaults, yield strategies, and DeFi payment cards.",
    url: siteUrl,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      category: "DeFi Protocol",
    },
    creator: {
      "@type": "Organization",
      name: "Moonight Protocol",
      url: siteUrl,
    },
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
