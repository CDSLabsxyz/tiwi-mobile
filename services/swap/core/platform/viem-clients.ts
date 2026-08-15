/**
 * Viem clients - React Native port.
 *
 * The web original (`lib/frontend/utils/viem-clients.ts`) resolves wallet
 * clients from an injected browser provider. On mobile there is no injected
 * provider: every EVM signature comes from the local key held by
 * `LocalSignerEngine`, so the wallet-client half of this module lives in
 * `platform/wallet-helpers.ts` and this file only owns:
 *
 *   - `getChainForId`  - a viem `Chain` for ANY EVM chain in the registry.
 *   - `getCachedPublicClient` - a per-chain, multi-endpoint read client.
 *
 * `getChainForId` is load-bearing: the app's older `SignerUtils.getChainById`
 * silently falls back to `mainnet` for unknown ids, which would sign a swap
 * with the wrong EIP-155 chainId. Everything under services/swap/core resolves
 * chains through here instead.
 */

import {
    createPublicClient,
    defineChain,
    fallback,
    http,
    type Chain,
    type PublicClient,
} from 'viem';
import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from 'viem/chains';
import { getRpcUrls, RPC_TRANSPORT_OPTIONS } from '@/services/swap/core/config/rpc-config';
import { getCanonicalChain } from '@/services/swap/core/registry/chains';

/**
 * Battle-tested viem chain configs for the primary chains (correct EIP-1559
 * settings, multicall3 addresses, …). Every other EVM chain is built on demand
 * from the canonical registry.
 */
const CHAIN_MAP: Record<number, Chain> = {
    1: mainnet,
    42161: arbitrum,
    10: optimism,
    137: polygon,
    8453: base,
    56: bsc,
    43114: avalanche,
};

const builtChainCache = new Map<number, Chain>();

function buildChainFromRegistry(chainId: number): Chain | null {
    const cached = builtChainCache.get(chainId);
    if (cached) return cached;

    const canonical = getCanonicalChain(chainId);
    if (!canonical || canonical.type !== 'EVM') return null;

    const rpcUrls = getRpcUrls(chainId);
    if (!rpcUrls || rpcUrls.length === 0) return null;

    const chain = defineChain({
        id: chainId,
        name: canonical.name,
        nativeCurrency: {
            name: canonical.nativeCurrency.symbol,
            symbol: canonical.nativeCurrency.symbol,
            decimals: canonical.nativeCurrency.decimals,
        },
        rpcUrls: {
            default: { http: rpcUrls },
            public: { http: rpcUrls },
        },
        ...(canonical.metadata?.explorerUrl
            ? {
                blockExplorers: {
                    default: {
                        name: `${canonical.name} Explorer`,
                        url: canonical.metadata.explorerUrl,
                    },
                },
            }
            : {}),
    });

    builtChainCache.set(chainId, chain);
    return chain;
}

function getChainConfig(chainId: number): Chain | null {
    return CHAIN_MAP[chainId] || buildChainFromRegistry(chainId);
}

export function getChainForId(chainId: number): Chain {
    const chain = getChainConfig(chainId);
    if (!chain) {
        const canonical = getCanonicalChain(chainId);
        if (canonical && canonical.type === 'EVM') {
            throw new Error(
                `No RPC configured for ${canonical.name} (chain ${chainId}). Add one to RPC_CONFIG to enable it.`,
            );
        }
        throw new Error(`Chain ${chainId} not supported`);
    }
    return chain;
}

/**
 * Same-shape helper as `getChainForId` but returns undefined instead of
 * throwing - for call sites that want to degrade rather than fail.
 */
export function tryGetChainForId(chainId: number): Chain | undefined {
    try {
        return getChainForId(chainId);
    } catch {
        return undefined;
    }
}

// ============================================================================
// PUBLIC CLIENT CACHING
// ============================================================================

const publicClientCache = new Map<number, PublicClient>();

/**
 * Receipt-polling interval per chain, in ms.
 *
 * This is the single biggest lever on *perceived* swap speed. viem's default is
 * 4000ms, so `waitForTransactionReceipt` can sit idle for up to 4s AFTER a
 * transaction is already mined - on BSC (~0.75s blocks) that's ~5x the actual
 * confirmation time spent doing nothing. A multi-leg swap waits on 3–4 receipts
 * (fee transfer, approve, leg 1, leg 2), so the default was adding well over
 * ten seconds of pure dead time to a 2-leg swap.
 *
 * Values track block time; polling faster than a block just wastes requests.
 */
const POLLING_INTERVAL_MS: Record<number, number> = {
    1: 3_000,      // Ethereum ~12s blocks
    56: 500,       // BSC ~0.75s
    137: 500,      // Polygon ~2s
    42161: 300,    // Arbitrum ~0.25s
    10: 700,       // Optimism ~2s
    8453: 700,     // Base ~2s
    43114: 700,    // Avalanche ~2s
    59144: 700,    // Linea
    534352: 700,   // Scroll
    999: 500,      // HyperEVM
};

/** Poll interval for a chain - defaults to 1s, which beats viem's 4s anywhere. */
export function getPollingInterval(chainId: number): number {
    return POLLING_INTERVAL_MS[chainId] ?? 1_000;
}

/**
 * JSON-RPC batching is DELIBERATELY NOT USED.
 *
 * Coalescing calls into one HTTP request is an obvious latency win on mobile,
 * but it is not safe across our public endpoint list. Verified against the BSC
 * endpoints in rpc-config on 2026-07-31 by POSTing a 2-call batch:
 *
 *   bsc-rpc.publicnode.com  → correct array response
 *   56.rpc.thirdweb.com     → correct array response
 *   rpc.ankr.com/bsc        → a SINGLE object with "id": null (not an array)
 *   binance.llamarpc.com    → empty body
 *   bsc.drpc.org            → rate-limit error for both calls
 *
 * viem maps batched responses back by id, so the two broken providers make
 * every call in the batch resolve to nothing - surfacing as
 * `The contract function "balanceOf" returned no data ("0x")`. Because
 * `fallback` rotates/ranks across providers, it failed intermittently.
 *
 * Do not re-enable without pinning to endpoints proven to honour batches.
 */

/**
 * Read client for a chain. Uses a health-ranked `fallback()` across every
 * configured endpoint so a single provider 429 doesn't fail a swap mid-flight
 * (the executors do several reads per swap: allowance, balance, receipt).
 */
export function getCachedPublicClient(chainId: number): PublicClient {
    const cached = publicClientCache.get(chainId);
    if (cached) return cached;

    const chain = getChainForId(chainId);
    const urls = getRpcUrls(chainId);

    const client = createPublicClient({
        chain,
        pollingInterval: getPollingInterval(chainId),
        transport:
            urls && urls.length > 0
                ? fallback(
                    urls.map((url) => http(url, { ...RPC_TRANSPORT_OPTIONS, retryCount: 1 })),
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
                )
                : http(undefined, RPC_TRANSPORT_OPTIONS),
    }) as PublicClient;

    publicClientCache.set(chainId, client);
    return client;
}

/**
 * Transport for SIGNING clients.
 *
 * Ordered failover across every configured endpoint (no latency ranking - the
 * ranker's background probes are wasted requests on a client that's idle
 * between swaps).
 *
 * The wallet client used to be pinned to `urls[0]`: one rate-limited or slow
 * provider and every signature crawled with no way out.
 */
export function createSigningTransport(chainId: number) {
    const urls = getRpcUrls(chainId);
    if (!urls || urls.length === 0) {
        return http(undefined, RPC_TRANSPORT_OPTIONS);
    }
    return fallback(
        urls.map((url) => http(url, { ...RPC_TRANSPORT_OPTIONS, retryCount: 1 })),
        { retryCount: 2, retryDelay: 200 },
    );
}

export function clearPublicClientCache(): void {
    publicClientCache.clear();
}

export function isChainSupported(chainId: number): boolean {
    return getChainConfig(chainId) !== null;
}

/**
 * Present so copied web executors that import it keep compiling. On mobile
 * there is no external provider to talk to - callers must go through
 * `getEVMWalletClient` in `platform/wallet-helpers.ts`.
 */
export async function getWalletClientForChain(): Promise<never> {
    throw new Error(
        'getWalletClientForChain is browser-only. Use getEVMWalletClient() from services/swap/core/utils/wallet-helpers.',
    );
}
