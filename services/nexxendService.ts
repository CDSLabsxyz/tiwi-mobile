/**
 * Nexxend balance provider.
 *
 * The TIWI super-app backend's /api/v1/wallet/balances endpoint currently
 * returns `{ balances: [], totalUSD: "0.00" }` for every wallet. Until that
 * regression is fixed server-side, the mobile client talks directly to
 * Nexxend - the upstream the TIWI backend was meant to proxy.
 *
 * This module returns data in the same `WalletBalanceResponse` shape
 * `api.wallet.balances()` used to return, so callers don't change.
 *
 * Nexxend response → TIWI shape mapping:
 *   data.chains[*].balances[*].token.{symbol,name,address,decimals,priceUsd,isNative}
 *   data.chains[*].balances[*].{balance,balanceFormatted,balanceUsd}
 *   data.chains[*].chainId  (string, e.g. "ethereum") → numeric chainId
 *
 * SECURITY: NEXXEND_API_KEY ships in the JS bundle (EXPO_PUBLIC_*) and is
 * extractable from any decompiled build. Rotate via the Nexxend dashboard
 * if leaked, and proxy through the TIWI backend once that's repaired.
 */

import type { WalletBalance, WalletBalanceResponse } from '@/lib/mobile/api-client';

const NEXXEND_BASE_URL =
    process.env.EXPO_PUBLIC_NEXXEND_API_URL ?? 'https://nexxend.xyz/api/v1';
const NEXXEND_API_KEY = process.env.EXPO_PUBLIC_NEXXEND_API_KEY;

// Nexxend uses chain *names* in responses; the rest of the app uses numeric
// chainIds. This mirrors the IDs declared in hooks/useWalletBalances.ts.
const NEXXEND_NAME_TO_ID: Record<string, number> = {
    ethereum: 1,
    bsc: 56,
    polygon: 137,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    avalanche: 43114,
    fantom: 250,
    linea: 59144,
    celo: 42220,
    gnosis: 100,
    solana: 7565164,
    tron: 728126428,
    ton: 1100,
};

interface NexxendToken {
    address: string; // "native" for natives, "0x…" for EVM, base58 mint for SPL
    symbol: string;
    name: string;
    decimals: number;
    chainId: string; // "ethereum"
    isNative: boolean;
    standard?: string;
    priceUsd?: number;
    logoUrl?: string;
}

interface NexxendBalanceEntry {
    token: NexxendToken;
    balance: string;
    balanceFormatted: string;
    balanceUsd?: number;
    lastUpdated?: number;
}

interface NexxendChainBlock {
    chainId: string;
    name: string;
    family: 'evm' | 'solana' | 'tron' | 'ton' | string;
    tokenCount: number;
    valueUsd: number;
    balances: NexxendBalanceEntry[];
    status?: string;
    lastUpdated?: number;
}

interface NexxendBalancesResponse {
    success: boolean;
    data?: {
        address: string;
        requestedChains: number[];
        resolvedChains: string[];
        totalValueUsd: number;
        totalTokenCount: number;
        chains: NexxendChainBlock[];
        errors?: any[];
        lastUpdated?: number;
    };
    error?: { code: string; message: string };
}

function emptyResponse(address: string, chains: number[]): WalletBalanceResponse {
    return {
        address,
        balances: [],
        totalUSD: '0.00',
        chains,
        timestamp: Date.now(),
    };
}

export async function getNexxendBalances(
    address: string,
    chainIds: number[],
): Promise<WalletBalanceResponse> {
    if (!NEXXEND_API_KEY) {
        throw new Error('NEXXEND_API_KEY missing - set EXPO_PUBLIC_NEXXEND_API_KEY');
    }

    // Build URL by string concatenation - `new URL('/wallet/balances', base)`
    // strips the /api/v1 prefix from base, which would route us to the wrong path.
    const finalUrl =
        NEXXEND_BASE_URL.replace(/\/$/, '') +
        `/wallet/balances?address=${encodeURIComponent(address)}` +
        (chainIds.length ? `&chainIds=${chainIds.join(',')}` : '');

    const res = await fetch(finalUrl, {
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': NEXXEND_API_KEY,
        },
    });

    // 400 = wallet family doesn't match any requested chains (e.g. an EVM
    // chainId list sent against a Solana address). Not a hard failure -
    // just means this branch has nothing to report. Same outcome as an
    // empty `balances` array.
    if (res.status === 400) {
        return emptyResponse(address, chainIds);
    }

    if (!res.ok) {
        throw new Error(`Nexxend ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as NexxendBalancesResponse;
    if (!json.success || !json.data) {
        return emptyResponse(address, chainIds);
    }

    const flat: WalletBalance[] = [];
    for (const chain of json.data.chains ?? []) {
        const numericChainId =
            NEXXEND_NAME_TO_ID[chain.chainId] ?? Number(chain.chainId);
        if (!numericChainId || Number.isNaN(numericChainId)) continue;

        for (const entry of chain.balances ?? []) {
            const t = entry.token;
            const price =
                typeof t.priceUsd === 'number' && isFinite(t.priceUsd) ? t.priceUsd : 0;
            const usd =
                typeof entry.balanceUsd === 'number' && isFinite(entry.balanceUsd)
                    ? entry.balanceUsd
                    : 0;

            flat.push({
                symbol: t.symbol,
                name: t.name,
                // "native" is preserved as-is - useWalletBalances dedupe step
                // already collapses "native" to the zero address.
                address: t.address,
                chainId: numericChainId,
                decimals: t.decimals,
                balance: entry.balance,
                balanceFormatted: entry.balanceFormatted,
                usdValue: usd.toFixed(8),
                priceUSD: price.toString(),
                // Nexxend's balances endpoint doesn't return 24h price change.
                // The Total Balance card will show 0.00% - improve later by
                // calling Nexxend's price endpoint or merging from CoinGecko.
                priceChange24h: '0',
                logoURI: t.logoUrl,
                // Mark natives so filterToken's `native_token === true` branch
                // applies the looser $0.01-or-real-logo threshold.
                verified: t.isNative === true ? true : undefined,
            });
        }
    }

    return {
        address: json.data.address,
        balances: flat,
        totalUSD: (json.data.totalValueUsd ?? 0).toFixed(2),
        chains: chainIds,
        timestamp: json.data.lastUpdated ?? Date.now(),
    };
}
