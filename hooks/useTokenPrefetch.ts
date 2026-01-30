import { apiClient } from '@/services/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

const TOP_CHAINS = [1, 56, 7565164, 137, 42161, 43114, 10]; // Eth, BNB, Solana, Polygon, Arbitrum, Avalanche, Optimism

/**
 * Hook to prefetch tokens for the most popular chains and a global list.
 * This ensures that when a user selects a chain, the token list is already cached.
 * Should be called in the root layout to execute on app load.
 */
export function useTokenPrefetch() {
    const queryClient = useQueryClient();

    useEffect(() => {
        // 1. Prefetch Global List (All Networks)
        queryClient.prefetchQuery({
            queryKey: ['tokensList', '', undefined, 100],
            queryFn: () => apiClient.getTokens({
                query: '',
                limit: 100
            }),
            staleTime: 1000 * 60 * 30, // 30 minutes
        });

        // 2. Prefetch Top Chains individually
        TOP_CHAINS.forEach(chainId => {
            queryClient.prefetchQuery({
                queryKey: ['tokensList', '', [chainId], 50],
                queryFn: () => apiClient.getTokens({
                    query: '',
                    chains: [chainId],
                    limit: 50
                }),
                staleTime: 1000 * 60 * 30, // 30 minutes
            });
        });
    }, [queryClient]);
}
