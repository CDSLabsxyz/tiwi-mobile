import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedPublicClient } from '@/services/swap/core/platform/viem-clients';

/**
 * useTWCSupply Hook
 *
 * Pulls live TWC supply numbers from the TIWI ecosystem API - the same
 * source the super-app reads for its "Total Supply" tile. The endpoint
 * already returns human-readable values (i.e. it has divided by the 9
 * token decimals), so callers just `parseFloat` and format.
 *
 * When that endpoint is unreachable we read `totalSupply()` straight off the
 * BSC contract, matching the super-app's fallback. TWC is deflationary, so the
 * genesis constant below is a last resort only - it does NOT reflect burns and
 * will read high (905T vs the ~895T actually outstanding).
 *
 * Persists to AsyncStorage so the tile renders instantly on cold start.
 */

const TIWI_SUPPLY_URL = 'https://api.tiwiecosystem.xyz/api/supply';

const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
const TWC_CHAIN_ID = 56;
const TWC_DECIMALS = 9;

// 905T - genesis supply. Last resort only; prefer the on-chain read.
const FALLBACK_TOTAL_SUPPLY = 905_000_000_000_000;

const ERC20_TOTAL_SUPPLY_ABI = [
    {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

/**
 * Live `totalSupply()` read on BSC - the source of truth whenever the
 * off-chain supply API is down.
 */
async function fetchOnChainTotalSupply(): Promise<number | null> {
    try {
        const client = getCachedPublicClient(TWC_CHAIN_ID);
        const raw = (await client.readContract({
            address: TWC_ADDRESS as `0x${string}`,
            abi: ERC20_TOTAL_SUPPLY_ABI,
            functionName: 'totalSupply',
        })) as bigint;

        const value = Number(raw) / 10 ** TWC_DECIMALS;
        return Number.isFinite(value) && value > 0 ? value : null;
    } catch (e) {
        console.warn('[useTWCSupply] On-chain totalSupply read failed:', e);
        return null;
    }
}

const CACHE_KEY = '@tiwi/home-twcSupply';

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

let diskCache: { data: TWCSupply; updatedAt: number } | undefined;
AsyncStorage.getItem(CACHE_KEY)
    .then(value => {
        if (!value) return;
        try { diskCache = JSON.parse(value); } catch {}
    })
    .catch(() => {});

export const useTWCSupply = () => {
    const hasSavedRef = useRef(false);

    const query = useQuery<TWCSupply>({
        queryKey: ['twcSupply'],
        queryFn: async () => {
            try {
                const res = await fetch(TIWI_SUPPLY_URL);
                if (!res.ok) throw new Error(`supply http ${res.status}`);
                const data = (await res.json()) as TWCSupplyResponse;
                const total = parseFloat(data.total_supply);
                const circ = parseFloat(data.circulating_supply);

                if (Number.isFinite(total) && total > 0) {
                    return {
                        totalSupply: total,
                        circulatingSupply: Number.isFinite(circ) && circ > 0 ? circ : 0,
                        updatedAt: data.updated_at ?? null,
                    };
                }
                throw new Error('supply api returned no usable total_supply');
            } catch (e) {
                console.warn('[useTWCSupply] Supply API unusable, reading on-chain:', e);
                const onChain = await fetchOnChainTotalSupply();
                return {
                    totalSupply: onChain ?? FALLBACK_TOTAL_SUPPLY,
                    circulatingSupply: 0,
                    updatedAt: null,
                };
            }
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        initialData: diskCache?.data,
        initialDataUpdatedAt: diskCache?.updatedAt,
    });

    useEffect(() => {
        if (query.data && !query.isPlaceholderData && query.dataUpdatedAt > (diskCache?.updatedAt || 0)) {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                const payload = { data: query.data, updatedAt: Date.now() };
                diskCache = payload;
                AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload)).catch(() => {});
            }
        } else {
            hasSavedRef.current = false;
        }
    }, [query.data, query.dataUpdatedAt]);

    return query;
};
