import { apiClient, TokenMetadata } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

// TWC Token Constants
const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
const TWC_CHAIN_ID = 56; // BNB Chain

/**
 * useTWCToken Hook
 * 
 * Fetches detailed market statistics for the $TWC token.
 */
export const useTWCToken = () => {
    return useQuery<TokenMetadata | null, Error>({
        queryKey: ['twcToken'],
        queryFn: async () => {
            const tokens = await apiClient.getTokens({
                address: TWC_ADDRESS,
                chains: [TWC_CHAIN_ID],
                limit: 1
            });
            return tokens.length > 0 ? tokens[0] : null;
        },
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000,
    });
};
