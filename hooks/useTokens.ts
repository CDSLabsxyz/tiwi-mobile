import { apiClient, type TokensResponse } from '@/services/apiClient';
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
    const queryResult = useQuery({
        queryKey: ['tokensList', query, chains, limit],
        queryFn: async (): Promise<TokensResponse> => {
            return apiClient.getTokens({
                query,
                chains,
                limit
            });
        },
        enabled,
        staleTime: 1000 * 60 * 10, // 10 minutes - Token lists don't change frequently
        // placeholderData: (previousData) => previousData, // Keep old data visible while fetching new (Cache-first)
    });

    return queryResult;
}
