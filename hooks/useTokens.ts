import { api, type TokensResponse } from '@/lib/mobile/api-client';
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
            return api.tokens.list({
                query,
                chains,
                limit
            });
        },
        enabled,
        staleTime: 1000 * 60 * 10, // 10 minutes - Token lists don't change frequently
    });

    return queryResult;
}
