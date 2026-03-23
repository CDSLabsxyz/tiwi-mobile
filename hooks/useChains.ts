import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch supported chains from the Tiwi backend
 */
export function useChains(type?: 'EVM' | 'Solana' | 'Cosmos' | 'TON' | 'TRON') {
    return useQuery({
        queryKey: ['supportedChains', type],
        queryFn: async () => {
            const resp = await api.chains.list({ type });
            return resp.chains;
        },
        staleTime: 1000 * 60 * 60, // 1 hour - chains don't change often
    });
}
