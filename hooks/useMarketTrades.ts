import { useBinanceTrades } from './useBinanceTrades';
import { useDydxTrades } from './useDydxTrades';

export interface Trade {
    id: string;
    side: 'BUY' | 'SELL';
    price: string;
    quantity: string;
    timestamp: number;
    total?: string;
}

export interface TradesState {
    trades: Trade[];
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    provider: 'binance' | 'dydx' | null;
}

interface UseMarketTradesOptions {
    symbol: string;
    marketType?: 'spot' | 'perp';
    enabled?: boolean;
}

/**
 * Master Dispatcher for Market Trades
 * Automatically routes requests to Binance (Spot) or dYdX (Perp)
 */
export const useMarketTrades = ({
    symbol,
    marketType = 'spot',
    enabled = true
}: UseMarketTradesOptions): TradesState => {
    // 1. Provider Detection Logic (Matches Orderbook logic)
    const upperSymbol = symbol.toUpperCase();
    const isPerp = marketType === 'perp';
    const isUSD = upperSymbol.endsWith('-USD') || upperSymbol.endsWith('/USD') ||
        upperSymbol.endsWith('-USDC') || upperSymbol.endsWith('/USDC');

    const isDydx = isPerp || isUSD;

    // 2. Call Providers
    // We pass empty symbols to inactive providers to prevent unnecessary WS connections
    const binanceData = useBinanceTrades(
        !isDydx && enabled ? symbol : ''
    );

    console.log("🚀 ~ useMarketTrades ~ symbol:", symbol)
    const dydxData = useDydxTrades(
        isDydx && enabled ? symbol : ''
    );

    // 3. Dispatch
    if (isDydx) {
        return {
            ...dydxData,
            provider: 'dydx'
        };
    }

    return {
        ...binanceData,
        provider: 'binance'
    };
};
