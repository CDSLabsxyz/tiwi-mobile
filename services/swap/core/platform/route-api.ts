/**
 * Route API - React Native port.
 *
 * Two executors re-quote mid-flight (`cross-chain-preswap-executor` needs a
 * fresh bridge quote for the stable it just swapped into; `tiwi-cctp-executor`
 * quotes the destination leg), so `fetchRoute` has to exist client-side. The
 * web version builds the URL from `window.location.origin`; on mobile it points
 * at the deployed backend (lite.tiwiprotocol.xyz by default).
 */

import { TIWI_API_BASE_URL } from '@/lib/mobile/api-client';
import type { RouterRoute } from '@/services/swap/core/router-types';

export interface FetchRouteParams {
    fromToken: {
        chainId: number;
        address: string;
        symbol?: string;
        decimals?: number;
    };
    toToken: {
        chainId: number;
        address: string;
        symbol?: string;
        decimals?: number;
    };
    fromAmount?: string;
    toAmount?: string;
    slippage?: number;
    slippageMode?: 'fixed' | 'auto';
    fromAddress?: string;
    recipient?: string;
    order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST';
    liquidityUSD?: number;
    gasTokenType?: number;
    poolAddress?: string;
    preferredRouter?: string;
}

export interface RouteAPIResponse {
    route: RouterRoute;
    alternatives?: RouterRoute[];
    timestamp: number;
    expiresAt: number;
    error?: string;
    /** Valid "no route" outcome (illiquid/unsupported pair), NOT an error. */
    noRoute?: boolean;
    reason?: 'no_liquidity' | 'unsupported_pair';
}

export async function fetchRoute(params: FetchRouteParams): Promise<RouteAPIResponse> {
    const url = new URL('/api/v1/route', TIWI_API_BASE_URL).toString();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        const data: RouteAPIResponse = await response.json();

        // The route service returns 200 with an `error` field for routing
        // failures, so status alone isn't enough.
        if (data.error) throw new Error(data.error);
        if (!response.ok) {
            throw new Error(data.error || `Failed to fetch route: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('[RouteAPI] Error fetching route:', error);
        throw error;
    }
}

export function isQuoteExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt;
}

export function getTimeUntilExpiration(expiresAt: number): number {
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}
