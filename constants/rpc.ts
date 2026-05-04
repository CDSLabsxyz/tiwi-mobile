/**
 * RPC Configuration for all supported chains.
 *
 * Single-endpoint reads on BSC were dropping pools from the staking dashboard
 * whenever Alchemy hiccuped, so BSC now uses a multi-provider fallback
 * transport via viem's `fallback()` (with health ranking).
 */

import { fallback, http, type Transport } from 'viem';

export const RPC_CONFIG: Record<number, string> = {
    1: 'https://eth-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    42161: 'https://arb-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    10: 'https://opt-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    137: 'https://polygon-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    8453: 'https://base-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    56: 'https://bnb-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
};

/**
 * BSC fallback endpoints — Alchemy first (paid, lowest latency for our key),
 * then well-known public providers. viem's `fallback` will rank these by
 * latency/health and rotate when one is degraded.
 */
const BSC_RPC_URLS = [
    RPC_CONFIG[56],
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://bsc.publicnode.com',
    'https://bsc.drpc.org',
    'https://binance.llamarpc.com',
    'https://rpc.ankr.com/bsc',
];

export function getRpcUrl(chainId: number): string | undefined {
    return RPC_CONFIG[chainId];
}

export const RPC_TRANSPORT_OPTIONS = {
    timeout: 15000,
    retryCount: 2,
} as const;

/**
 * Build a robust BSC read transport that rotates across multiple endpoints.
 *
 * `rank: true` makes viem probe latency/health every minute and prefer the
 * fastest healthy endpoint, so a single provider going down (or rate-limiting)
 * no longer causes individual `readContract` calls to fail.
 */
export function createBscFallbackTransport(): Transport {
    return fallback(
        BSC_RPC_URLS.map((url) => http(url, { timeout: 15000, retryCount: 1 })),
        {
            rank: {
                interval: 60_000,
                sampleCount: 3,
                timeout: 2_000,
                weights: { latency: 0.3, stability: 0.7 },
            },
            retryCount: 3,
            retryDelay: 250,
        },
    );
}

/**
 * Standard transport selector — use this anywhere a chainId is known.
 * Returns the multi-provider fallback transport for BSC (so writes/reads
 * both survive Alchemy 429s) and the single-endpoint http transport for
 * every other chain.
 */
export function createTransportForChain(chainId: number): Transport {
    if (chainId === 56) return createBscFallbackTransport();
    return http(getRpcUrl(chainId), { timeout: 15000 });
}
