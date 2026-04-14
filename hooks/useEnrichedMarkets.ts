import { api, MarketAsset } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For internal typing in the hook logic
interface EnrichedMarketCompat extends MarketAsset {
    displaySymbol: string;
    priceUSD: string;
}

const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596'.toLowerCase();
const CACHE_KEY_PREFIX = '@tiwi/markets-';

// In-memory cache loaded from disk on first mount
const diskCache: Record<string, { data: MarketAsset[]; updatedAt: number }> = {};
let diskCacheLoaded = false;

// Load disk cache once at module level
AsyncStorage.multiGet([
    `${CACHE_KEY_PREFIX}all`,
    `${CACHE_KEY_PREFIX}spot`,
    `${CACHE_KEY_PREFIX}perp`,
]).then(entries => {
    for (const [key, value] of entries) {
        if (value) {
            try {
                const parsed = JSON.parse(value);
                const cacheId = key.replace(CACHE_KEY_PREFIX, '');
                diskCache[cacheId] = parsed;
            } catch {}
        }
    }
    diskCacheLoaded = true;
}).catch(() => { diskCacheLoaded = true; });

interface UseEnrichedMarketsOptions {
    marketType?: 'Swap' | 'Spot' | 'Perps' | 'Stocks' | 'Forex' | 'all';
    limit?: number;
    enabled?: boolean;
}

/**
 * useEnrichedMarkets Hook
 *
 * Fetches unified market data with disk-persisted cache for instant loads.
 */
export const useEnrichedMarkets = (options: UseEnrichedMarketsOptions = {}) => {
    const { marketType = 'all', limit = 250, enabled = true } = options;
    const cacheId = String(marketType).toLowerCase();
    const hasSavedRef = useRef(false);

    const cached = diskCache[cacheId];

    const query = useQuery<MarketAsset[], Error>({
        queryKey: ['enrichedMarkets', marketType, limit],
        queryFn: async () => {
            const response = await api.market.list({ marketType, limit });
            return response.markets || [];
        },
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        enabled,
        // Show disk-cached data instantly while API fetches in background
        initialData: cached?.data,
        initialDataUpdatedAt: cached?.updatedAt,
    });

    // Persist fresh data to disk (once per fetch cycle)
    useEffect(() => {
        if (query.data && query.data.length > 0 && !query.isPlaceholderData && query.dataUpdatedAt > (cached?.updatedAt || 0)) {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                const payload = { data: query.data, updatedAt: Date.now() };
                diskCache[cacheId] = payload;
                AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${cacheId}`, JSON.stringify(payload)).catch(() => {});
            }
        } else {
            hasSavedRef.current = false;
        }
    }, [query.data, query.dataUpdatedAt]);

    const data = useMemo(() => {
        if (!query.data || !Array.isArray(query.data)) return [];

        let markets = query.data.map(m => {
            const cleanSymbol = m.symbol.toUpperCase();
            const displaySymbol = cleanSymbol.split('-')[0].split('/')[0];

            return {
                ...m,
                displaySymbol: displaySymbol || cleanSymbol,
                logoURI: m.logoURI || m.logo,
                priceUSD: (m.price || 0).toString(),
            } as EnrichedMarketCompat;
        });

        // TWC Priority Logic
        const twcIndex = markets.findIndex(
            m =>
                (m.address && m.address.toLowerCase() === TWC_ADDRESS) ||
                (m.symbol.toUpperCase() === 'TWC')
        );

        if (twcIndex > -1) {
            const [twcToken] = markets.splice(twcIndex, 1);
            markets.unshift(twcToken);
        }

        return markets;
    }, [query.data]);

    return {
        ...query,
        data,
    };
};
