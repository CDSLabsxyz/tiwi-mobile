import { OrderBookData } from '@/services/apiClient';
import { useBinanceOrderbook } from './useBinanceOrderbook';
import { useDydxOrderbook } from './useDydxOrderbook';

interface UseOrderBookOptions {
    symbol: string;
    address?: string;
    chainId?: number;
    marketType?: 'spot' | 'perp';
    enabled?: boolean;
}

/**
 * useOrderBook Master Dispatcher (Phase 1)
 * 
 * Automatically routes to the appropriate provider:
 * - dYdX: For Perps or USD-quoted pairs.
 * - Binance: For standard Spot pairs (USDT).
 * 
 * This hook leverages real-time WebSockets with smart fallbacks
 * while providing a unified data interface for the UI.
 */
export const useOrderBook = (options: UseOrderBookOptions) => {
    const {
        symbol,
        marketType = 'spot',
        enabled = true,
    } = options;

    // 1. Provider Logic: Detect which backend/WS to use
    // dYdX handles all Perps and USD/USDC markets in TIWI
    const isPerp = marketType === 'perp';
    const upperSymbol = symbol.toUpperCase();
    const isUSD = upperSymbol.endsWith('-USD') || upperSymbol.endsWith('/USD') ||
        upperSymbol.endsWith('-USDC') || upperSymbol.endsWith('/USDC');
    const isDydx = isPerp || isUSD;

    // 2. Symbol Parsing for Providers
    // Split BTC-USDT -> [BTC, USDT]
    const parts = symbol.split(/[-/_]/);
    const base = parts[0] || symbol;
    const quote = parts[1] || 'USDT';

    // 3. Initialize Provider Hooks
    // Passing empty strings ensures inactive providers don't open WebSockets
    const binanceState = useBinanceOrderbook(
        !isDydx && enabled ? base : '',
        !isDydx && enabled ? quote : '',
        marketType
    );

    const dydxState = useDydxOrderbook(
        isDydx && enabled ? symbol : ''
    );

    // 4. Select Active State
    const activeState = isDydx ? dydxState : binanceState;

    // 5. Unified Return Object
    return {
        data: (activeState.isLoading && !activeState.bids.length) ? null : {
            symbol,
            bids: activeState.bids,
            asks: activeState.asks,
            currentPrice: activeState.currentPrice,
            lastUpdateId: 0,
            timestamp: Date.now(),
        } as OrderBookData,
        isLoading: activeState.isLoading,
        isError: !!activeState.error,
        isConnected: activeState.isConnected,
        provider: isDydx ? 'dydx' : 'binance',
        error: activeState.error,
    };
};
