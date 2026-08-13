/**
 * Fee-on-transfer aware `minAmountOut` resolution.
 *
 * PancakeSwap's `getAmountsOut` uses pair reserves and cannot see token transfer
 * taxes. Probe the exact swap call at several output floors, then apply the
 * user's slippage setting to the highest floor the chain accepts.
 */

import { formatUnits, type Address, type Hex, type PublicClient } from 'viem';
import { useSwapStore } from '@/store/swapStore';

const SHORTFALL_LADDER_BPS = [
  0, 25, 50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1300, 1700, 2200, 3500,
];

const AUTO_SLIPPAGE_BPS = 100;
const MIN_SLIPPAGE_BPS = 10;

export function getSlippageBps(): number {
  try {
    const { isAutoSlippage, slippage } = useSwapStore.getState();
    if (isAutoSlippage) return AUTO_SLIPPAGE_BPS;
    const bps = Math.round(slippage * 100);
    return Math.max(MIN_SLIPPAGE_BPS, Math.min(bps, 5000));
  } catch {
    return AUTO_SLIPPAGE_BPS;
  }
}

export interface ProbeCall {
  to: Address;
  data: Hex;
  value?: bigint;
  account: Address;
}

export interface MinOutputResult {
  minAmountOut: bigint;
  achievableOutput: bigint;
  shortfallBps: number;
  measured: boolean;
}

export async function resolveMinAmountOut(
  client: PublicClient,
  quotedOutput: bigint,
  buildCall: (minAmountOut: bigint) => ProbeCall,
): Promise<MinOutputResult> {
  const slippageBps = getSlippageBps();
  const applySlippage = (out: bigint) =>
    (out * BigInt(10000 - slippageBps)) / BigInt(10000);

  if (quotedOutput <= BigInt(0)) {
    return {
      minAmountOut: BigInt(0),
      achievableOutput: quotedOutput,
      shortfallBps: 0,
      measured: false,
    };
  }

  const candidates = SHORTFALL_LADDER_BPS.map((bps) => ({
    bps,
    output: (quotedOutput * BigInt(10000 - bps)) / BigInt(10000),
  }));

  // All probes are independent eth_call requests, so run them in one round-trip.
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const call = buildCall(candidate.output);
        await client.call({
          to: call.to,
          data: call.data,
          value: call.value ?? BigInt(0),
          account: call.account,
        });
        return candidate;
      } catch {
        return null;
      }
    }),
  );

  const best = results.find((result): result is (typeof candidates)[number] => result !== null);

  if (!best) {
    return {
      minAmountOut: applySlippage(quotedOutput),
      achievableOutput: quotedOutput,
      shortfallBps: 0,
      measured: false,
    };
  }

  return {
    minAmountOut: applySlippage(best.output),
    achievableOutput: best.output,
    shortfallBps: best.bps,
    measured: true,
  };
}

export function describeMinOutput(result: MinOutputResult, decimals: number): string {
  if (!result.measured) {
    return `minOut ${formatUnits(result.minAmountOut, decimals)} (unmeasured, quote-based)`;
  }

  return (
    `minOut ${formatUnits(result.minAmountOut, decimals)} ` +
    `(achievable ${formatUnits(result.achievableOutput, decimals)}, ` +
    `transfer tax ~${(result.shortfallBps / 100).toFixed(2)}%, ` +
    `slippage ${(getSlippageBps() / 100).toFixed(2)}%)`
  );
}
