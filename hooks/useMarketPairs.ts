import { apiClient, MarketTokenPair } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596'.toLowerCase();

export type MarketCategory = 'hot' | 'new' | 'gainers' | 'losers';

interface UseMarketPairsOptions {
    category: MarketCategory;
    limit?: number;
    chains?: number[];
    enabled?: boolean;
}

/**
 * useMarketPairs Hook
 * 
 * Fetches tokens by category and handles TWC priority logic.
 */
export const useMarketPairs = (options: UseMarketPairsOptions) => {
    const { category, limit = 20, chains, enabled = true } = options;

    const query = useQuery<MarketTokenPair[], Error>({
        queryKey: ['tokens', category, limit, chains],
        queryFn: () => apiClient.getMarketPairs({ category, limit, chains }),
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000,
        enabled,
    });

    const data = useMemo(() => {
        if (!query.data || !Array.isArray(query.data)) return [];

        let tokens = [...query.data];

        // TWC Priority Logic for 'hot' and 'gainers'
        if (category === 'hot' || category === 'gainers') {
            const twcIndex = tokens.findIndex(
                t => t.address.toLowerCase() === TWC_ADDRESS
            );

            if (twcIndex > -1) {
                // Move TWC to the top if found
                const [twcToken] = tokens.splice(twcIndex, 1);
                tokens.unshift(twcToken);
            }
        }

        return tokens;
    }, [query.data, category]);

    return {
        ...query,
        data,
    };
};
