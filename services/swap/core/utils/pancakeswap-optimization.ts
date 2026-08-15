// Ultra-fast optimization utilities: client caching, request deduplication, and caching
// Matches tiwi-test implementation exactly

import { createPublicClient, http, fallback, type PublicClient, type Address } from 'viem';
import { getChainConfig } from './chain-config';

// ============================================================================
// CLIENT CACHING - Singleton instances per chain
// ============================================================================

const clientCache = new Map<number, PublicClient>();

import { getRpcUrl, getRpcUrls, RPC_TRANSPORT_OPTIONS } from '@/services/swap/core/config/rpc-config';
import { getPollingInterval } from '@/services/swap/core/platform/viem-clients';

/**
 * Get cached public client instance for a chain (singleton pattern)
 * Optimized with fast timeouts and connection pooling
 */
export function getCachedClient(chainId: number): PublicClient {
  if (!clientCache.has(chainId)) {
    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    const customRpcUrls = getRpcUrls(chainId);

    if (customRpcUrls && customRpcUrls.length > 0) {
      clientCache.set(chainId, createPublicClient({
        chain,
        pollingInterval: getPollingInterval(chainId),
        transport: fallback(
          // `rank` is a fallback() option, not an http() one - the web copy
          // passes it here where it's simply ignored. Dropped so it typechecks
          // against the mobile viem version (ranking is off by default anyway).
          customRpcUrls.map(url => http(url, { ...RPC_TRANSPORT_OPTIONS, timeout: 10000 }))
        ),
      }));
    } else {
      const rpcUrl = getRpcUrl(chainId);
      clientCache.set(chainId, createPublicClient({
        chain,
        pollingInterval: getPollingInterval(chainId),
        transport: http(rpcUrl, {
          ...RPC_TRANSPORT_OPTIONS,
          timeout: 10000, // Keep faster timeout for optimization layer
        }),
      }));
    }
  }
  return clientCache.get(chainId)!;
}

// ============================================================================
// REQUEST DEDUPLICATION - Prevent duplicate concurrent requests
// ============================================================================

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicate concurrent requests - if same request is already pending, return that promise
 */
export async function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  const promise = fn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}

// ============================================================================
// CACHING LAYER - TTL-based caching for expensive operations
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const caches = {
  pairAddresses: new Map<string, CacheEntry<Address | null>>(),
  quotes: new Map<string, CacheEntry<any>>(),
  allowances: new Map<string, CacheEntry<bigint>>(),
  reserves: new Map<string, CacheEntry<any>>(),
};

const TTL = {
  pairAddress: 30000, // 30 seconds
  quote: 5000, // 5 seconds
  allowance: 10000, // 10 seconds
  reserves: 10000, // 10 seconds
};

function getCacheKey(prefix: string, ...args: any[]): string {
  return `${prefix}:${args.map(a => String(a)).join(':')}`;
}

function isExpired<T>(entry: CacheEntry<T> | undefined): boolean {
  if (!entry) return true;
  return Date.now() > entry.expiresAt;
}

/**
 * Get cached value or execute function and cache result
 */
export async function getCached<T>(
  cacheType: keyof typeof caches,
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cache = caches[cacheType];
  const entry = cache.get(key);

  if (!isExpired(entry)) {
    return entry!.data;
  }

  const data = await fn();
  (cache as any).set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
  return data;
}

/**
 * Cache pair address lookup
 */
export async function getCachedPairAddress(
  tokenA: Address,
  tokenB: Address,
  chainId: number,
  fn: () => Promise<Address | null>
): Promise<Address | null> {
  const key = getCacheKey('pair', chainId, tokenA.toLowerCase(), tokenB.toLowerCase());
  return getCached('pairAddresses', key, TTL.pairAddress, fn);
}

/**
 * Cache quote
 */
export async function getCachedQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: string,
  chainId: number,
  fn: () => Promise<any>
): Promise<any> {
  const key = getCacheKey('quote', chainId, tokenIn.toLowerCase(), tokenOut.toLowerCase(), amountIn);
  return getCached('quotes', key, TTL.quote, fn);
}

/**
 * Clear cache for a specific type
 */
export function clearCache(cacheType?: keyof typeof caches): void {
  if (cacheType) {
    caches[cacheType].clear();
  } else {
    Object.values(caches).forEach(cache => cache.clear());
  }
}

// ============================================================================
// TIMEOUT RACING - Fast failure for slow operations
// ============================================================================

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Fast timeout wrapper for RPC calls (500ms for pair checks, 1s for quotes)
 */
export async function fastRpcCall<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 2000
): Promise<T> {
  return withTimeout(fn(), timeoutMs, 'RPC call timeout');
}

