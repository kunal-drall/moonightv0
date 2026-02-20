"use client";

import React from "react";
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  argent,
  braavos,
  useInjectedConnectors,
} from "@starknet-react/core";

const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";
const chain = isMainnet ? mainnet : sepolia;

function StarknetProviderInner({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
    order: "alphabetical",
  });

  return (
    <StarknetConfig
      chains={[chain]}
      provider={publicProvider()}
      connectors={connectors}
      autoConnect
    >
      {children}
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
