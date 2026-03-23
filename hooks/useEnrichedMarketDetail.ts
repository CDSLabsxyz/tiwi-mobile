import { api, MarketAsset } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';

interface UseEnrichedMarketDetailOptions {
    symbol: string;
    provider?: 'binance' | 'dydx' | 'onchain' | 'dexscreener';
    address?: string;
    chainId?: number;
    marketType?: 'spot' | 'perp' | 'all';
    enabled?: boolean;
}

/**
 * useEnrichedMarketDetail Hook
 * 
 * Fetches deep market metadata for a specific pair using the new Mobile SDK.
 */
export const useEnrichedMarketDetail = (options: UseEnrichedMarketDetailOptions) => {
    const { symbol, provider, address, chainId, marketType, enabled = true } = options;

    // Normalize symbol for backend dispatcher (e.g. BTC/USD -> BTC-USD)
    let normalizedSymbol = symbol.toUpperCase().replace('/', '-').replace('_', '-');

    if (!normalizedSymbol.includes('-') && (marketType === 'spot' || !marketType)) {
        normalizedSymbol = `${normalizedSymbol}-USD`;
    }

    return useQuery<any, Error>({
        queryKey: ['enrichedMarketDetail', normalizedSymbol, address, marketType],
        queryFn: async () => {
            // Note: The new SDK uses market.list or tokens.list for generic lookups
            // If the specific detail endpoint isn't in the SDK, we use the tokens or market list
            const response = await api.market.list({ marketType: marketType === 'all' ? 'all' : marketType as any, limit: 100 });
            const data = response.markets.find(m =>
                m.symbol.toUpperCase() === normalizedSymbol.split('-')[0] ||
                m.address?.toLowerCase() === address?.toLowerCase()
            );

            if (!data) {
                // Secondary attempt via tokens.list
                const tokenResponse = await api.tokens.list({ query: symbol, chains: chainId ? [chainId] : undefined, limit: 1 });
                if (tokenResponse.tokens.length === 0) throw new Error('Market data not found');

                const t = tokenResponse.tokens[0];
                return {
                    ...t,
                    displaySymbol: `${t.symbol}-USD`,
                    priceUSD: t.priceUSD || '0',
                };
            }

            const cleanSymbol = data.symbol.toUpperCase();
            let displaySymbol = cleanSymbol;

            if (data.marketType === 'perp') {
                displaySymbol = cleanSymbol.includes('-') ? cleanSymbol : `${cleanSymbol}-USD`;
            } else {
                displaySymbol = (cleanSymbol.includes('/') || cleanSymbol.includes('-')) ? cleanSymbol : `${cleanSymbol}-USD`;
            }

            // Flatten backend response for mobile UI compatibility
            return {
                ...data,
                id: data.id || (data.address ? `${data.chainId}-${data.address}` : data.symbol),
                displaySymbol,
                logoURI: data.logoURI || data.logo || '',
                priceUSD: (data.price || 0).toString(),
            };
        },
        staleTime: 10 * 1000,
        enabled: enabled && !!symbol,
    });
};
