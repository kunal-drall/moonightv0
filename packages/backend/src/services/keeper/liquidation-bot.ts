import { Contract } from "starknet";
import { BaseKeeper } from "./base-keeper.js";
import { getProvider } from "../../utils/starknet.js";
import { sendAlert } from "../../utils/alerts.js";
import { config } from "../../config.js";

const CDP_MANAGER_ABI = [
  {
    name: "calculate_health_factor",
    type: "function",
    inputs: [{ name: "position_id", type: "felt" }],
    outputs: [{ name: "health_factor", type: "Uint256" }],
    stateMutability: "view",
  },
  {
    name: "liquidate",
    type: "function",
    inputs: [{ name: "position_id", type: "felt" }],
    outputs: [],
  },
] as const;

const SCALE = 10n ** 18n;

export class LiquidationBot extends BaseKeeper {
  private activePositions: Set<string> = new Set();
  private cdpContract: Contract;

  constructor() {
    super("liquidation", 15_000); // 15 second polling
    const provider = getProvider();
    this.cdpContract = new Contract({
      abi: CDP_MANAGER_ABI as any,
      address: config.CDP_MANAGER_ADDRESS,
      providerOrAccount: provider,
    });
  }

  addPosition(positionId: string): void {
    this.activePositions.add(positionId);
  }

  removePosition(positionId: string): void {
    this.activePositions.delete(positionId);
  }

  async tick(): Promise<void> {
    if (this.activePositions.size === 0) {
      this.log.debug("No active positions to monitor");
      return;
    }

    this.log.debug({ count: this.activePositions.size }, "Checking positions");
    const toLiquidate: string[] = [];

    for (const positionId of this.activePositions) {
      try {
        const hf = await this.cdpContract.calculate_health_factor(positionId);
        const healthFactor = BigInt(hf.toString());

        if (healthFactor <= SCALE) {
          this.log.warn(
            { positionId, healthFactor: healthFactor.toString() },
            "Undercollateralized position found"
          );
          toLiquidate.push(positionId);
        }
      } catch (error) {
        this.log.error({ positionId, error }, "Failed to check HF");
      }
    }

    for (const positionId of toLiquidate) {
      try {
        const txHash = await this.executeTx([
          {
            contractAddress: config.CDP_MANAGER_ADDRESS,
            entrypoint: "liquidate",
            calldata: [positionId],
          },
        ]);
        this.log.info({ positionId, txHash }, "Position liquidated");
        this.activePositions.delete(positionId);
        await sendAlert(
          "Liquidation Executed",
          `Position ${positionId} liquidated. TX: ${txHash}`,
          "info"
        );
      } catch (error) {
        this.log.error({ positionId, error }, "Liquidation failed");
        await sendAlert(
          "Liquidation Failed",
          `Position ${positionId}: ${error}`,
          "critical"
        );
      }
    }
  }
}
