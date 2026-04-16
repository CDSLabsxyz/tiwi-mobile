import { useQuery } from '@tanstack/react-query';

/**
 * useTWCSupply Hook
 *
 * Pulls live TWC supply numbers from the TIWI ecosystem API — the same
 * source the super-app reads for its "Total Supply" tile. The endpoint
 * already returns human-readable values (i.e. it has divided by the 9
 * token decimals), so callers just `parseFloat` and format.
 *
 * If the endpoint is unreachable we fall back to the deflationary
 * static genesis supply so the home screen never shows N/A.
 */

const TIWI_SUPPLY_URL = 'https://api.tiwiecosystem.xyz/api/supply';

// 905T — genesis supply, used when the live API is unreachable.
const FALLBACK_TOTAL_SUPPLY = 905_000_000_000_000;

interface TWCSupplyResponse {
    name: string;
    symbol: string;
    chain: string;
    decimals: number;
    total_supply: string;
    circulating_supply: string;
    updated_at: string;
}

export interface TWCSupply {
    totalSupply: number;
    circulatingSupply: number;
    updatedAt: string | null;
}

export const useTWCSupply = () => {
    return useQuery<TWCSupply>({
        queryKey: ['twcSupply'],
        queryFn: async () => {
            try {
                const res = await fetch(TIWI_SUPPLY_URL);
                if (!res.ok) throw new Error(`supply http ${res.status}`);
                const data = (await res.json()) as TWCSupplyResponse;
                const total = parseFloat(data.total_supply);
                const circ = parseFloat(data.circulating_supply);
                return {
                    totalSupply: Number.isFinite(total) && total > 0 ? total : FALLBACK_TOTAL_SUPPLY,
                    circulatingSupply: Number.isFinite(circ) && circ > 0 ? circ : 0,
                    updatedAt: data.updated_at ?? null,
                };
            } catch (e) {
                console.warn('[useTWCSupply] Falling back to static supply:', e);
                return { totalSupply: FALLBACK_TOTAL_SUPPLY, circulatingSupply: 0, updatedAt: null };
            }
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
    });
};
