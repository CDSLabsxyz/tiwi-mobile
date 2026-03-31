import { api, type TokensResponse } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';

interface UseTokensParams {
    query?: string;
    chains?: number[];
    limit?: number;
    enabled?: boolean;
    category?: 'hot' | 'new' | 'gainers' | 'losers' | 'trending';
}

/**
 * Hook to fetch tokens based on search query and chain filters
 */
export function useTokens({ query, chains, limit = 50, enabled = true, category }: UseTokensParams) {
    const queryResult = useQuery({
        queryKey: ['tokensList', query, chains, limit, category],
        queryFn: async (): Promise<TokensResponse> => {
            return api.tokens.list({
                query,
                chains,
                limit,
                category,
            });
        },
        enabled,
        staleTime: 1000 * 60 * 10,
    });

    return queryResult;
}
