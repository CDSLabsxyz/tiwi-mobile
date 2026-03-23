import { api } from '@/lib/mobile/api-client';
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
    return useQuery({
        queryKey: ['twcToken'],
        queryFn: async () => {
            const resp = await api.tokens.list({
                address: TWC_ADDRESS,
                chains: [TWC_CHAIN_ID],
                limit: 1
            });
            return resp.tokens.length > 0 ? resp.tokens[0] : null;
        },
        staleTime: 30 * 1000, // 30 seconds
    });
};
