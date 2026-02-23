export interface CDPEvent {
  positionId: bigint;
  owner: string;
  collateralType: string;
  eventType: "opened" | "closed" | "liquidated" | "updated";
  blockNumber: number;
  txHash: string;
  timestamp: number;
}

export interface PriceSnapshot {
  btcUsd: number;
  wbtcUsd: number;
  timestamp: number;
  blockNumber: number;
}

export interface KeeperEvent {
  keeperType: string;
  action: string;
  txHash: string | null;
  status: "success" | "failed";
  error: string | null;
  timestamp: number;
}
