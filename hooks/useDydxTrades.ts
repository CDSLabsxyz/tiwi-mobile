import { useCallback, useEffect, useRef, useState } from "react";
import { Trade, TradesState } from "./useMarketTrades";

/**
 * dYdX v4 Trades Engine (Phase B: High-Performance)
 * Implements Batching, Throttling, and Shape-Agnostic Normalization.
 */
export function useDydxTrades(market: string): TradesState {
    const [state, setState] = useState<TradesState>({
        trades: [],
        isConnected: false,
        isLoading: true,
        error: null,
        provider: 'dydx'
    });

    const wsRef = useRef<WebSocket | null>(null);
    const tradesBuffer = useRef<Trade[]>([]);
    const updateThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Normalize market symbol for dYdX v4
    let dydxMarket = market.toUpperCase().replace('_', '-').replace('/', '-');
    if (dydxMarket.includes('USDT')) dydxMarket = dydxMarket.replace('USDT', 'USD');
    if (dydxMarket && !dydxMarket.includes('-')) dydxMarket = `${dydxMarket}-USD`;

    // Normalizer: Handles positional arrays [0,1,2...] from dYdX v4 correctly
    const normalizeTrade = (t: any): Trade | null => {
        if (!t) return null;

        // v4 structure often uses 'side', 'price', 'size'. 
        // We use positional fallbacks for resiliency.
        const id = t.id || t[0] || Math.random().toString();
        const side = (t.side || t[1] || 'BUY').toUpperCase() as 'BUY' | 'SELL';
        const price = t.price || t[2];
        const size = t.size || t[3];
        const timestamp = t.createdAt ? new Date(t.createdAt).getTime() : (t[4] || Date.now());

        if (price === undefined || size === undefined) return null;

        return {
            id: String(id),
            side,
            price: String(price),
            quantity: String(size),
            timestamp: Number(timestamp),
            total: (parseFloat(String(price)) * parseFloat(String(size))).toString()
        };
    };

    const scheduleUpdate = useCallback(() => {
        if (updateThrottle.current) return;
        updateThrottle.current = setTimeout(() => {
            updateThrottle.current = null;

            setState(prev => {
                // Combine buffer with existing trades, keeping first 40 (most recent)
                const combined = [...tradesBuffer.current, ...prev.trades];
                tradesBuffer.current = []; // Clear buffer

                return {
                    ...prev,
                    trades: combined.slice(0, 40),
                    isLoading: false
                };
            });
        }, 300); // 300ms Render Cycle for UI stability
    }, []);

    useEffect(() => {
        if (!market) {
            setState(prev => ({ ...prev, trades: [], isConnected: false, isLoading: false }));
            return;
        }

        // 1. Initial Fetch to warm up the state
        const fetchInitialTrades = async () => {
            try {
                const response = await fetch(`https://indexer.dydx.trade/v4/trades?market=${dydxMarket}&limit=20`);
                const data = await response.json();
                if (data.trades) {
                    const normalized = data.trades
                        .map(normalizeTrade)
                        .filter((t: any): t is Trade => t !== null);

                    setState(prev => ({
                        ...prev,
                        trades: normalized,
                        isLoading: false
                    }));
                }
            } catch (err) {
                console.error('[useDydxTrades] Initial Fetch Error:', err);
            }
        };

        const connect = () => {
            const ws = new WebSocket('wss://indexer.dydx.trade/v4/ws');
            wsRef.current = ws;

            ws.onopen = () => {
                setState(prev => ({ ...prev, isConnected: true }));
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    channel: 'v4_trades',
                    id: dydxMarket
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'channel_data' && data.contents?.trades) {
                        const newTrades = data.contents.trades
                            .map(normalizeTrade)
                            .filter((t: any): t is Trade => t !== null);

                        if (newTrades.length > 0) {
                            // Prepend to buffer (newest trades first)
                            tradesBuffer.current = [...newTrades, ...tradesBuffer.current];
                            scheduleUpdate();
                        }
                    }
                } catch (err) {
                    console.error('[useDydxTrades] WS Error:', err);
                }
            };

            ws.onclose = () => {
                setState(prev => ({ ...prev, isConnected: false }));
            };

            ws.onerror = () => {
                setState(prev => ({ ...prev, error: 'Connection failed' }));
                ws.close();
            };
        };

        fetchInitialTrades();
        connect();

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (updateThrottle.current) clearTimeout(updateThrottle.current);
        };
    }, [dydxMarket, market, scheduleUpdate]);

    return state;
}