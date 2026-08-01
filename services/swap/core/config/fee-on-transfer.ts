/**
 * Fee-on-transfer (taxed) token registry + the bridgeable stable used to route around them.
 *
 * Aggregators (LiFi / Relay / Rubic) call plain router functions, which revert on a token that
 * takes a cut inside `transfer`. That breaks BOTH directions of a cross-chain swap:
 *
 *   • taxed token as SOURCE      → their source swap reverts   → `CrossChainPreSwapExecutor`
 *   • taxed token as DESTINATION → their dest swap reverts and the bridge refunds the user in the
 *     deposited currency (e.g. a SOL→TWC swap lands as USDC on Solana)
 *                                                             → `CrossChainPostSwapExecutor`
 *
 * Both executors split the swap at a liquid stable and run the taxed leg through our own
 * fee-on-transfer-safe BSC executors, so the registry lives here rather than inside either one.
 */

/** Keyed by `${chainId}:${address_lowercased}`. Extend as new taxed tokens are listed. */
const FEE_ON_TRANSFER_TOKENS = new Set<string>([
  '56:0xda1060158f7d593667cce0a15db346bb3ffb3596', // TWC on BSC
]);

export function isFeeOnTransfer(chainId: number, address?: string): boolean {
  if (!address) return false;
  return FEE_ON_TRANSFER_TOKENS.has(`${chainId}:${address.toLowerCase()}`);
}

/**
 * The bridgeable stablecoin used as the leg-1 → leg-2 handoff on a given chain. Picked for
 * bridge coverage, not for spread: every aggregator can deliver these, and every chain here has
 * a deep local pair against them.
 */
export const CHAIN_STABLE: Record<number, { address: string; symbol: string; decimals: number }> = {
  56: { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
  1: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
  137: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
  42161: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
  8453: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  10: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6 },
  43114: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6 },
};

export function getChainStable(chainId: number) {
  return CHAIN_STABLE[chainId];
}

/**
 * Bridges have minimums + relayer fees that make a sub-~$3 crossing refund. Both split
 * executors reject below this BEFORE any signature, so the user never pays gas for a swap that
 * cannot complete on the destination.
 */
export const MIN_CROSS_CHAIN_USD = 3;

/** Minimal bigint → decimal string (avoids importing formatUnits type friction). */
export function formatUnitsSafe(value: bigint, decimals: number): string {
  const s = value.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}
