import { apiClient } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch supported chains from the Tiwi backend,
 * optionally filtered by ecosystem types (e.g., ['evm', 'solana'])
 */
export function useChains(ecosystems?: string[]) {
    return useQuery({
        queryKey: ['supportedChains', ecosystems],
        queryFn: async () => {
            return apiClient.getChains(ecosystems);
        },
        staleTime: 1000 * 60 * 60, // 1 hour - chains don't change often
    });
}
