import { apiClient, EnrichedMarket } from '@/services/apiClient';
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
 * Fetches deep market metadata for a specific pair, including 
 * funding rates, open interest, and social links.
 */
export const useEnrichedMarketDetail = (options: UseEnrichedMarketDetailOptions) => {
    const { symbol, provider, address, chainId, marketType, enabled = true } = options;

    // Normalize symbol for backend dispatcher (e.g. BTC/USD -> BTC-USD)
    let normalizedSymbol = symbol.toUpperCase().replace('/', '-').replace('_', '-');

    // Safety Fallback: If no pair separator is found and it's a spot market, 
    // the new backend logic specifically requires a BASE-QUOTE format.
    if (!normalizedSymbol.includes('-') && marketType === 'spot') {
        normalizedSymbol = `${normalizedSymbol}-USD`;
    }

    return useQuery<EnrichedMarket, Error>({
        queryKey: ['enrichedMarketDetail', normalizedSymbol, address, marketType],
        queryFn: async () => {
            const data = await apiClient.getEnrichedMarketDetail(normalizedSymbol, {
                provider,
                address,
                chainId,
                marketType
            });

            if (!data || !data.symbol) {
                throw new Error('Market data not found');
            }

            const cleanSymbol = data.symbol.toUpperCase();
            let displaySymbol = cleanSymbol;

            if (data.marketType === 'perp') {
                displaySymbol = cleanSymbol.includes('-') ? cleanSymbol : `${cleanSymbol}-USD`;
            } else {
                displaySymbol = data.pair || ((cleanSymbol.includes('/') || cleanSymbol.includes('-')) ? cleanSymbol : `${cleanSymbol}-USD`);
            }

            // Flatten backend response for mobile UI compatibility
            return {
                ...data,
                id: data.id || (data.contractAddress ? `${data.chainId}-${data.contractAddress}` : data.symbol),
                displaySymbol,
                name: data.metadata?.name || data.name || data.baseToken?.name || data.symbol,
                address: data.contractAddress || data.baseToken?.address || data.symbol,
                logo: data.metadata?.logo || data.baseToken?.logo || '',
                logoURI: data.metadata?.logo || data.baseToken?.logo || '',
                description: data.metadata?.description || '',
                priceUSD: (data.priceUSD || data.price || 0).toString(),
                high24h: data.high24h || 0,
                low24h: data.low24h || 0,
                marketCap: data.marketCap || 0,
                circulatingSupply: data.circulatingSupply || 0,
                maxSupply: data.maxSupply || 0,
            } as any; // Cast to any to allow flattened properties for UI
        },
        staleTime: 10 * 1000,
        enabled: enabled && !!symbol,
    });
};
