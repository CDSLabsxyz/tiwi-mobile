import { apiClient } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

export function useSpotlightTokens(activeOnly: boolean = true) {
    return useQuery({
        queryKey: ['spotlightTokens', activeOnly],
        queryFn: async () => {
            return await apiClient.getSpotlightTokens(activeOnly);
        },
        staleTime: 1000 * 60 * 15, // Spotlight tokens change less frequently (15 mins)
    });
}
