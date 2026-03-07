import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import StarknetProvider from "@/providers/StarknetProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet"
  ? "https://app.moonight.fun"
  : "https://sepolia.moonight.fun";

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
    "strkBTC", "privacy", "zkKYC", "S-two",
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
      "Mint moonUSD against your Bitcoin on Starknet. Access delta-neutral vaults, yield strategies, and DeFi-native payments.",
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
    creator: "@moonaborz",
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
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      url: "https://moonight.fun",
    },
  };

  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} font-display min-h-screen bg-surface-0 text-text-0`}
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
