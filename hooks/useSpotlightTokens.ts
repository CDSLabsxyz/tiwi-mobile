import { api, MarketAsset } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export function useSpotlightTokens(activeOnly: boolean = true) {
    // Subscribe to the unified market list so Spotlight chips share the same
    // price / 24h / volume source as Explore and Favourite. If another part of
    // the app has already fetched this key, we just read the cached data.
    const { data: marketPairs = [] } = useQuery<MarketAsset[]>({
        queryKey: ['enrichedMarkets', 'all', 250],
        queryFn: () => api.market.list({ marketType: 'all', limit: 250 }).then(r => r.markets || []),
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    // Fetch the raw spotlight roster. Enrichment is applied below so it can
    // re-run whenever the shared market list updates.
    const { data: raw = [], isLoading, ...rest } = useQuery({
        queryKey: ['spotlightTokensRaw', activeOnly],
        queryFn: async () => {
            const response = await api.tokenSpotlight.get({ category: 'spotlight', activeOnly: true });
            const tokens = Array.isArray(response) ? response : response?.tokens || [];
            const today = new Date().toISOString().split('T')[0];
            return tokens
                .filter((t: any) => (!t.startDate || t.startDate <= today) && (!t.endDate || t.endDate >= today))
                .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0));
        },
        staleTime: 1000 * 60 * 5,
    });

    const data = useMemo(() => {
        const byAddr = new Map<string, any>();
        const bySymbol = new Map<string, any>();
        (marketPairs || []).forEach((m: any) => {
            if (m.address) byAddr.set(`${m.chainId}-${m.address.toLowerCase()}`, m);
            const register = (key: string) => {
                if (!key) return;
                const K = key.toUpperCase();
                const existing = bySymbol.get(K);
                if (!existing) bySymbol.set(K, m);
                else if (!existing.address && m.address) bySymbol.set(K, m);
            };
            register(m.symbol);
            // Strip CEX pair suffix (`BTCUSDT` → `BTC`, `TWC-USDT` → `TWC`)
            // so the spotlight token's base ticker still resolves.
            const stripped = (m.symbol || '').toUpperCase().split('-')[0].split('/')[0];
            if (stripped !== (m.symbol || '').toUpperCase()) register(stripped);
            register((m as any).displaySymbol);
        });

        return (raw as any[]).map((t: any) => {
            const chainId = t.chainId || 56;
            const live =
                (t.address && byAddr.get(`${chainId}-${t.address.toLowerCase()}`)) ||
                (t.symbol && bySymbol.get(t.symbol.toUpperCase()));

            if (live) {
                return {
                    ...t,
                    id: t.id || `${chainId}-${t.address}`,
                    priceUSD: String(live.price ?? live.priceUSD ?? '0'),
                    change24h: live.priceChange24h ?? 0,
                    volume24h: live.volume24h ?? 0,
                    marketCap: live.marketCap ?? 0,
                };
            }

            // No match in the unified list — use server-side enriched fields
            // from the spotlight response so we don't render $0.00 / +0.00%.
            return {
                ...t,
                id: t.id || `${chainId}-${t.address}`,
                priceUSD: t.priceUSD ?? t.price ?? '0',
                change24h: t.change24h ?? t.priceChange24h ?? 0,
                volume24h: t.volume24h ?? 0,
                marketCap: t.marketCap ?? 0,
            };
        });
    }, [raw, marketPairs]);

    return { data, isLoading, ...rest };
}
