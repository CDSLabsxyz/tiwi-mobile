import { apiClient } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';

export function useMarketPrice(pair: string = 'TWC-USDT', chainId: number = 56) {
    return useQuery({
        queryKey: ['marketPrice', pair, chainId],
        queryFn: async () => {
            return await apiClient.getMarketPrice(pair, chainId);
        },
        staleTime: 1000 * 30, // Market price changes frequently (30 seconds)
        refetchInterval: 1000 * 60, // Auto-refresh every minute
    });
}
