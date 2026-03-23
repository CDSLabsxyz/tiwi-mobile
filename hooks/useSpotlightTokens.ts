import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';

export function useSpotlightTokens(activeOnly: boolean = true) {
    return useQuery({
        queryKey: ['spotlightTokens', activeOnly],
        queryFn: async () => {
            const tokens = await api.tokenSpotlight.get();
            // The new SDK returns SpotlightToken[] which might need mapping for Price/Change
            return (tokens || []).map((t: any) => ({
                ...t,
                priceUSD: t.priceUSD || t.price || '0',
                change24h: t.change24h || t.priceChange24h || 0,
            }));
        },
        staleTime: 1000 * 60 * 15, // Spotlight tokens change less frequently (15 mins)
    });
}
