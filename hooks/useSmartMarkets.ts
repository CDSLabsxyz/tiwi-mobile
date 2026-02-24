import { apiClient } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

/**
 * useSmartMarkets Hook
 * 
 * Fetches the list of supported DEXes and Bridges (Smart Markets) 
 * either from LI.FI or the Tiwi Backend.
 */
export const useSmartMarkets = () => {
    return useQuery({
        queryKey: ['smartMarkets'],
        queryFn: () => apiClient.getSmartMarkets(),
        staleTime: 24 * 60 * 60 * 1000, // 24 hours (supported tools don't change often)
        gcTime: 48 * 60 * 60 * 1000,
    });
};
