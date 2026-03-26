import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';

export function useSpotlightTokens(activeOnly: boolean = true) {
    return useQuery({
        queryKey: ['spotlightTokens', activeOnly],
        queryFn: async () => {
            const tokens = await api.tokenSpotlight.get({ category: 'spotlight', activeOnly: true });
            const today = new Date().toISOString().split('T')[0];
            
            // Mirroring Web App logic (startDate <= today <= endDate)
            const active = (tokens || []).filter((t: any) => 
                (!t.startDate || t.startDate <= today) && 
                (!t.endDate || t.endDate >= today)
            ).sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0));

            return active.map((t: any) => ({
                ...t,
                id: t.id || `${t.chainId}-${t.address}`,
                priceUSD: t.priceUSD || t.price || '0',
                change24h: t.change24h || t.priceChange24h || 0,
            }));
        },
        staleTime: 1000 * 60 * 15, // Spotlight tokens change less frequently (15 mins)
    });
}
