/**
 * RPC Configuration for all supported chains.
 *
 * Single-endpoint reads on BSC were dropping pools from the staking dashboard
 * whenever Alchemy hiccuped, so BSC now uses a multi-provider fallback
 * transport via viem's `fallback()` (with health ranking).
 */

import { fallback, http, type Transport } from 'viem';

/** Alchemy endpoints — kept as the FALLBACK behind dRPC (see DRPC_CONFIG). */
export const RPC_CONFIG: Record<number, string> = {
    1: 'https://eth-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    42161: 'https://arb-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    10: 'https://opt-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    137: 'https://polygon-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    8453: 'https://base-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    56: 'https://bnb-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',
    43114: 'https://avalanche-c-chain-rpc.publicnode.com',
    1116: 'https://rpc.coredao.org',
    1329: 'https://evm-rpc.sei-apis.com',
    999: 'https://rpc.hyperliquid.xyz/evm',
};

/**
 * dRPC — the PRIMARY provider (authenticated, higher limits). Statically
 * reference the env var so Expo inlines it at build time. dRPC's load-balanced
 * endpoint is `https://lb.drpc.org/ogrpc?network=<slug>&dkey=<KEY>`.
 */
const DRPC_API_KEY = process.env.EXPO_PUBLIC_DRPC_API_KEY;

const DRPC_NETWORK_SLUGS: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    10: 'optimism',
    137: 'polygon',
    8453: 'base',
    56: 'bsc',
    43114: 'avalanche',
    1116: 'core',
    1329: 'sei',
    999: 'hyperliquid',
};

function drpcUrl(chainId: number): string | undefined {
    const slug = DRPC_NETWORK_SLUGS[chainId];
    if (!slug || !DRPC_API_KEY) return undefined;
    return `https://lb.drpc.org/ogrpc?network=${slug}&dkey=${DRPC_API_KEY}`;
}

/**
 * BSC fallback endpoints, in preference order.
 *
 * The authenticated dRPC endpoint goes FIRST when a key is configured. This
 * list previously started with the hardcoded Alchemy URL, which meant every
 * BSC read led with a provider whose free-tier monthly quota is exhausted —
 * it answers `429 Monthly capacity limit exceeded`, so viem burned a retry
 * cycle on it before rotating, on every single call. Alchemy is now last so
 * it is still available if the quota resets, without being on the hot path.
 *
 * `rpc.ankr.com/bsc` was removed: it now answers `-32000 Unauthorized: You
 * must authenticate` with HTTP 200, which costs a full round trip before viem
 * can classify it as a failure.
 */
const BSC_RPC_URLS = [
    drpcUrl(56),
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://bsc.publicnode.com',
    'https://bsc.drpc.org',
    RPC_CONFIG[56],
].filter(Boolean) as string[];

/**
 * Per-chain fallback endpoint lists — our Alchemy key first (lowest latency),
 * then well-known keyless public providers. Without these, a single free-tier
 * Alchemy 429 (e.g. the nonce lookup during a send) would fail the whole tx.
 * A multi-send loop hammers one key in quick succession, so this matters most
 * there — but every EVM read/write benefits.
 */
const CHAIN_RPC_FALLBACKS: Record<number, string[]> = {
    1: [
        RPC_CONFIG[1],
        'https://ethereum-rpc.publicnode.com',
        'https://eth.llamarpc.com',
        'https://eth.drpc.org',
        'https://rpc.ankr.com/eth',
        'https://cloudflare-eth.com',
    ],
    42161: [
        RPC_CONFIG[42161],
        'https://arb1.arbitrum.io/rpc',
        'https://arbitrum-one-rpc.publicnode.com',
        'https://arbitrum.llamarpc.com',
        'https://arbitrum.drpc.org',
        'https://rpc.ankr.com/arbitrum',
    ],
    10: [
        RPC_CONFIG[10],
        'https://mainnet.optimism.io',
        'https://optimism-rpc.publicnode.com',
        'https://optimism.llamarpc.com',
        'https://optimism.drpc.org',
        'https://rpc.ankr.com/optimism',
    ],
    137: [
        RPC_CONFIG[137],
        'https://polygon-rpc.com',
        'https://polygon-bor-rpc.publicnode.com',
        'https://polygon.llamarpc.com',
        'https://polygon.drpc.org',
        'https://rpc.ankr.com/polygon',
    ],
    8453: [
        RPC_CONFIG[8453],
        'https://mainnet.base.org',
        'https://base-rpc.publicnode.com',
        'https://base.llamarpc.com',
        'https://base.drpc.org',
        'https://rpc.ankr.com/base',
    ],
    56: BSC_RPC_URLS,
    43114: [
        RPC_CONFIG[43114],
        'https://api.avax.network/ext/bc/C/rpc',
        'https://avalanche.drpc.org',
    ],
    1116: [
        RPC_CONFIG[1116],
        'https://core.drpc.org',
    ],
    1329: [
        RPC_CONFIG[1329],
        'https://sei.drpc.org',
    ],
    999: [
        RPC_CONFIG[999],
        'https://hyperliquid.drpc.org',
    ],
};

/** Primary URL for a chain: dRPC when a key is configured, else Alchemy. */
export function getRpcUrl(chainId: number): string | undefined {
    return drpcUrl(chainId) ?? RPC_CONFIG[chainId];
}

export const RPC_TRANSPORT_OPTIONS = {
    timeout: 15000,
    retryCount: 2,
} as const;

/**
 * Build a health-ranked, retrying fallback transport from a list of endpoints.
 * `rank` makes viem probe latency/health each minute and prefer the fastest
 * healthy endpoint, so one provider rate-limiting (429) or going down no longer
 * fails calls — viem rotates + retries across the rest.
 */
function createFallbackTransport(urls: string[]): Transport {
    return fallback(
        // 15s per endpoint meant a single unreachable provider stalled a read
        // for 30s (timeout + one retry) before the next was tried. 6s is well
        // clear of a healthy mobile round trip while failing over quickly.
        urls.filter(Boolean).map((url) => http(url, { timeout: 6000, retryCount: 1 })),
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

/** Kept for callers that reference it directly. */
export function createBscFallbackTransport(): Transport {
    return createFallbackTransport(BSC_RPC_URLS);
}

/**
 * Standard transport selector — use this anywhere a chainId is known. Returns a
 * multi-provider fallback transport (survives Alchemy 429s) for every chain we
 * have a fallback list for; other chains get a single http endpoint but still
 * with a retry so a transient blip doesn't hard-fail.
 */
export function createTransportForChain(chainId: number): Transport {
    const primary = drpcUrl(chainId); // dRPC first when configured
    const base = CHAIN_RPC_FALLBACKS[chainId] ?? [];
    // dRPC (primary) → Alchemy → public providers. De-dupe defensively.
    const urls = Array.from(new Set([primary, ...base].filter(Boolean))) as string[];
    if (urls.length > 0) return createFallbackTransport(urls);
    return http(getRpcUrl(chainId), { timeout: 15000, retryCount: 2 });
}
