"use client";

import React from "react";
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  ready,
  braavos,
  useInjectedConnectors,
} from "@starknet-react/core";
import StarkzapProvider from "@/providers/StarkzapProvider";

const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";
const chain = isMainnet ? mainnet : sepolia;

function StarknetProviderInner({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [ready(), braavos()],
    includeRecommended: "always",
    order: "random",
  });

  return (
    <StarknetConfig
      chains={[chain]}
      provider={publicProvider()}
      connectors={connectors}
      autoConnect
    >
      <StarkzapProvider>{children}</StarkzapProvider>
    </StarknetConfig>
  );
}

export default function StarknetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StarknetProviderInner>{children}</StarknetProviderInner>;
}
