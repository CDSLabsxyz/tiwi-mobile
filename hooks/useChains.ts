import { apiClient } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch all supported chains from the Tiwi backend
 */
export function useChains() {
    return useQuery({
        queryKey: ['supportedChains'],
        queryFn: async () => {
            return apiClient.getChains();
        },
        staleTime: 1000 * 60 * 60, // 1 hour - chains don't change often
    });
}
