/**
 * Liquidity Hub - shared DTO types (ported from tiwi-user-app
 * lib/shared/types/liquidity.ts). Mirrors the shapes returned by the
 * /api/v1/pools and /api/v1/pool-positions routes.
 *
 * All token amounts cross boundaries as human-readable strings (converted with
 * viem parseUnits/formatUnits at the edge) - large NUMERIC values must never
 * round-trip through a JS Number.
 */

export type LiquidityPoolStatus = 'pending' | 'active' | 'rejected' | 'inactive';
export type LiquidityPositionStatus = 'pending' | 'verified' | 'rejected' | 'withdrawn';

export interface LiquidityToken {
  symbol?: string;
  address: string;
  logo?: string;
  decimals?: number;
}

/** Live on-chain snapshot of a deployed TiwiLiquidityPair (null when unreadable / registry-only). */
export interface LiquidityPoolOnChain {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  reserve0Formatted: string;
  reserve1Formatted: string;
  reserveAFormatted?: string;
  reserveBFormatted?: string;
  aIsToken0?: boolean;
  totalSupply: string;
  feeBps: number;
}

export interface LiquidityPool {
  id: string;
  creatorWallet: string;
  chainId: number;
  chainName: string;
  chainSlug?: string;
  chainLogo?: string;

  pair: string;
  pairAddress?: string;
  factoryAddress?: string;
  feeBps: number;
  feeLevel: string;

  tokenA: LiquidityToken;
  tokenB: LiquidityToken;

  seedAmountA: string;
  seedAmountB: string;
  startingPrice?: string;
  minPrice?: string;
  maxPrice?: string;

  tvlUsd: number;
  volume24hUsd: number;
  volume30dUsd?: number;
  aprPct?: number;
  rewardAprPct?: number;

  status: LiquidityPoolStatus;
  tradable: boolean;
  source: 'tiwi' | 'external';
  dexName?: string;
  category?: string;

  transactionHash?: string;
  createdAt: string;
  updatedAt: string;

  onChain?: LiquidityPoolOnChain | null;
}

export interface LiquidityPositionOnChain {
  lpBalance: string;
  sharePct: string;
  redeemableA: string;
  redeemableB: string;
}

export interface LiquidityPosition {
  id: string;
  userWallet: string;
  poolId: string;
  amountA: string;
  amountB: string;
  lpTokens: string;
  poolShare: string;
  status: LiquidityPositionStatus;
  transactionHash?: string;
  createdAt: string;
  updatedAt: string;
  pool?: Partial<LiquidityPool>;
  onChain?: LiquidityPositionOnChain | null;
}

// ---------------------------------------------------------------------------
// Request payloads (mirror after the device signs on-chain)
// ---------------------------------------------------------------------------

export interface CreateLiquidityPoolInput {
  creatorWallet: string;
  chainId: number;
  chainName: string;
  chainSlug?: string;
  chainLogo?: string;
  pair: string;
  pairAddress?: string;
  factoryAddress?: string;
  feeBps?: number;
  tokenA: LiquidityToken;
  tokenB: LiquidityToken;
  seedAmountA?: string;
  seedAmountB?: string;
  startingPrice?: string;
  minPrice?: string;
  maxPrice?: string;
  tvlUsd?: number;
  status?: LiquidityPoolStatus;
  tradable?: boolean;
  source?: 'tiwi' | 'external';
  dexName?: string;
  transactionHash?: string;
}

export interface UpdateLiquidityPoolInput {
  id: string;
  pairAddress?: string;
  factoryAddress?: string;
  tvlUsd?: number;
  volume24hUsd?: number;
  status?: LiquidityPoolStatus;
  tradable?: boolean;
  category?: string;
}

export interface CreateLiquidityPositionInput {
  userWallet: string;
  poolId: string;
  amountA?: string;
  amountB?: string;
  lpTokens?: string;
  poolShare?: string;
  status?: LiquidityPositionStatus;
  transactionHash?: string;
}

export interface UpdateLiquidityPositionInput {
  id: string;
  amountA?: string;
  amountB?: string;
  lpTokens?: string;
  poolShare?: string;
  status?: LiquidityPositionStatus;
  transactionHash?: string;
}

/** A single swap row from GET /api/v1/pools/{chain}/{address}/swaps */
export interface PoolTransactionRow {
  txHash: string;
  blockNumber: number;
  timestamp: number | null;
  sender: string;
  to: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  amountIn: string;
  amountOut: string;
  valueUsd: number;
}

/** Format a basis-point fee as a percent label, e.g. 30 -> '0.30%'. */
export function feeBpsToLabel(feeBps: number): string {
  const pct = feeBps / 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toString()}%`;
}
