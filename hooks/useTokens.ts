import { apiClient } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

interface UseTokensParams {
    query?: string;
    chains?: number[];
    limit?: number;
    enabled?: boolean;
}

/**
 * Hook to fetch tokens based on search query and chain filters
 */
export function useTokens({ query, chains, limit = 50, enabled = true }: UseTokensParams) {
    return useQuery({
        queryKey: ['tokensList', query, chains, limit],
        queryFn: async () => {
            return apiClient.getTokens({
                query,
                chains,
                limit
            });
        },
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
