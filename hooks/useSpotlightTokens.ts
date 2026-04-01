import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';

export function useSpotlightTokens(activeOnly: boolean = true) {
    return useQuery({
        queryKey: ['spotlightTokensEnriched', activeOnly],
        queryFn: async () => {
            const response = await api.tokenSpotlight.get({ category: 'spotlight', activeOnly: true });
            const tokens = Array.isArray(response) ? response : response?.tokens || [];
            const today = new Date().toISOString().split('T')[0];

            const active = tokens
                .filter((t: any) => (!t.startDate || t.startDate <= today) && (!t.endDate || t.endDate >= today))
                .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0));

            // Enrich each token with price data from token-info API
            const enriched = await Promise.all(active.map(async (t: any) => {
                const chainId = t.chainId || 56;
                let price = 0;
                let change = 0;

                if (t.address) {
                    try {
                        const info = await api.tokenInfo.get(chainId, t.address);
                        const pool = info?.pool;
                        if (pool) {
                            price = parseFloat(pool.priceUsd || '0');
                            change = pool.priceChange24h || 0;
                        }
                    } catch {}
                }

                return {
                    ...t,
                    id: t.id || `${chainId}-${t.address}`,
                    priceUSD: price > 0 ? String(price) : (t.priceUSD || t.price || '0'),
                    change24h: change !== 0 ? change : (t.change24h || t.priceChange24h || 0),
                };
            }));

            return enriched;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
