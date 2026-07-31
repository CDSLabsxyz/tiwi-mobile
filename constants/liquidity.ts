/**
 * TIWI Liquidity Hub — chain constants + address registry for React Native.
 *
 * Factory/router addresses are provided by the backend (GET /api/v1/liquidity-addresses)
 * and cached here via `setLiquidityAddresses`, with an EXPO_PUBLIC_* env fallback for
 * offline/dev. Wrapped-native + viem chain map are bundled public constants.
 *
 * Mirrors tiwi-user-app/lib/contracts/liquidity-addresses.ts + the WRAPPED_NATIVE
 * map in hooks/useLiquidityHub.ts.
 */
import { createPublicClient, type Address, type PublicClient } from 'viem';
import { mainnet, bsc, polygon, arbitrum, base, optimism, avalanche } from 'viem/chains';
import { createTransportForChain } from './rpc';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

// viem chains for the 7 live EVM chains (default bsc), matching the web CHAIN_MAP.
const CHAIN_MAP: Record<number, any> = {
  1: mainnet, 56: bsc, 137: polygon, 42161: arbitrum, 8453: base, 10: optimism, 43114: avalanche,
};

export const LIQUIDITY_CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 56: 'BNB Chain', 137: 'Polygon', 42161: 'Arbitrum',
  8453: 'Base', 10: 'Optimism', 43114: 'Avalanche',
};

/** Wrapped-native token per chain (all 18-dec). Chains absent here reject native pools. */
export const WRAPPED_NATIVE: Record<number, Address> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',   // WETH
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // WBNB
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',  // WPOL
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  8453: '0x4200000000000000000000000000000000000006',  // WETH
  10: '0x4200000000000000000000000000000000000006',    // WETH
  43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
};

// Native sentinel addresses used across the app.
const NATIVE_SENTINELS = new Set(['', ZERO.toLowerCase(), '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee']);
export const isZeroOrNative = (addr?: string): boolean => !addr || NATIVE_SENTINELS.has(addr.toLowerCase());

// ---------------------------------------------------------------------------
// Address registry (server-populated, env fallback)
// ---------------------------------------------------------------------------

let FACTORY_ADDRESSES: Record<number, Address> = {};
let ROUTER_ADDRESSES: Record<number, Address> = {};

const isEvmAddr = (v?: string | null): v is Address =>
  !!v && /^0x[a-fA-F0-9]{40}$/.test(v) && v.toLowerCase() !== ZERO.toLowerCase();

/** Populate the factory/router maps from the backend liquidity-addresses response. */
export function setLiquidityAddresses(cfg: {
  factories?: Record<string, string>;
  routers?: Record<string, string>;
}) {
  if (cfg.factories) {
    for (const [id, addr] of Object.entries(cfg.factories)) {
      if (isEvmAddr(addr)) FACTORY_ADDRESSES[Number(id)] = addr;
    }
  }
  if (cfg.routers) {
    for (const [id, addr] of Object.entries(cfg.routers)) {
      if (isEvmAddr(addr)) ROUTER_ADDRESSES[Number(id)] = addr;
    }
  }
}

let bootstrapped = false;
/**
 * Fetch the factory/router map from the backend once and cache it. When
 * /api/v1/liquidity-addresses is deployed this covers every chain; until then
 * it fails silently and the EXPO_PUBLIC_* env fallback below is used.
 */
export async function bootstrapLiquidityAddresses(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    const { api } = await import('@/lib/mobile/api-client');
    const cfg = await api.liquidity.addresses();
    if (cfg && (cfg.factories || cfg.routers)) setLiquidityAddresses(cfg);
  } catch {
    bootstrapped = false; // allow a later retry
  }
}

/** EXPO_PUBLIC_ env fallback (statically referenced so Expo inlines them). */
const ENV_FACTORY: Record<number, string | undefined> = {
  1: process.env.EXPO_PUBLIC_LIQUIDITY_FACTORY_1,
  56: process.env.EXPO_PUBLIC_LIQUIDITY_FACTORY_56,
  137: process.env.EXPO_PUBLIC_LIQUIDITY_FACTORY_137,
  42161: process.env.EXPO_PUBLIC_LIQUIDITY_FACTORY_42161,
  8453: process.env.EXPO_PUBLIC_LIQUIDITY_FACTORY_8453,
  10: process.env.EXPO_PUBLIC_LIQUIDITY_FACTORY_10,
  43114: process.env.EXPO_PUBLIC_LIQUIDITY_FACTORY_43114,
};
const ENV_ROUTER: Record<number, string | undefined> = {
  1: process.env.EXPO_PUBLIC_LIQUIDITY_ROUTER_1,
  56: process.env.EXPO_PUBLIC_LIQUIDITY_ROUTER_56,
  137: process.env.EXPO_PUBLIC_LIQUIDITY_ROUTER_137,
  42161: process.env.EXPO_PUBLIC_LIQUIDITY_ROUTER_42161,
  8453: process.env.EXPO_PUBLIC_LIQUIDITY_ROUTER_8453,
  10: process.env.EXPO_PUBLIC_LIQUIDITY_ROUTER_10,
  43114: process.env.EXPO_PUBLIC_LIQUIDITY_ROUTER_43114,
};

export function getLiquidityFactoryAddress(chainId: number): Address | undefined {
  const fromCfg = FACTORY_ADDRESSES[chainId];
  if (isEvmAddr(fromCfg)) return fromCfg;
  const fromEnv = ENV_FACTORY[chainId];
  return isEvmAddr(fromEnv) ? fromEnv : undefined;
}

export function getLiquidityRouterAddress(chainId: number): Address | undefined {
  const fromCfg = ROUTER_ADDRESSES[chainId];
  if (isEvmAddr(fromCfg)) return fromCfg;
  const fromEnv = ENV_ROUTER[chainId];
  return isEvmAddr(fromEnv) ? fromEnv : undefined;
}

/** True when the on-chain AMM is live on this chain (factory deployed). */
export function isLiquidityChainLive(chainId: number): boolean {
  return getLiquidityFactoryAddress(chainId) !== undefined;
}

/** Chain-pinned viem public client for on-chain reads (never a connector client). */
export function getLiquidityPublicClient(chainId: number): PublicClient {
  const chain = CHAIN_MAP[chainId] || bsc;
  return createPublicClient({ chain, transport: createTransportForChain(chainId) }) as PublicClient;
}
