import { api, MarketAsset } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

// For internal typing in the hook logic
interface EnrichedMarketCompat extends MarketAsset {
    displaySymbol: string;
    priceUSD: string;
}

const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596'.toLowerCase();

interface UseEnrichedMarketsOptions {
    marketType?: 'spot' | 'perp' | 'all' | 'swap';
    limit?: number;
    enabled?: boolean;
}

/**
 * useEnrichedMarkets Hook
 * 
 * Fetches unified market data (Binance, dYdX, On-chain)
 * using the new Mobile SDK and handles TIWICAT (TWC) priority logic.
 */
export const useEnrichedMarkets = (options: UseEnrichedMarketsOptions = {}) => {
    const { marketType = 'all', limit = 250, enabled = true } = options;

    const query = useQuery<MarketAsset[], Error>({
        queryKey: ['enrichedMarkets', marketType, limit],
        queryFn: async () => {
            const response = await api.market.list({ marketType, limit });
            return response.markets || [];
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        enabled,
    });

    const data = useMemo(() => {
        if (!query.data) return [];

        let markets = query.data.map(m => {
            const cleanSymbol = m.symbol.toUpperCase();
            let displaySymbol = cleanSymbol;

            // Smart Suffix Logic
            if (m.marketType === 'perp') {
                displaySymbol = cleanSymbol.includes('-') ? cleanSymbol : `${cleanSymbol}-USD`;
            } else {
                displaySymbol = (cleanSymbol.includes('/') || cleanSymbol.includes('-')) ? cleanSymbol : `${cleanSymbol}-USD`;
            }

            // Map new SDK properties to what the UI expects (Price/PriceUSD bridge)
            return {
                ...m,
                displaySymbol,
                logoURI: m.logoURI || m.logo,
                priceUSD: (m.price || 0).toString(),
            } as EnrichedMarketCompat;
        });

        // TWC Priority Logic
        const twcIndex = markets.findIndex(
            m =>
                (m.address && m.address.toLowerCase() === TWC_ADDRESS) ||
                (m.symbol.toUpperCase() === 'TWC')
        );

        if (twcIndex > -1) {
            const [twcToken] = markets.splice(twcIndex, 1);
            markets.unshift(twcToken);
        }

        return markets;
    }, [query.data]);

    return {
        ...query,
        data,
    };
};
