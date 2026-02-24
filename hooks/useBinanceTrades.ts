import { useCallback, useEffect, useRef, useState } from "react";
import { Trade, TradesState } from "./useMarketTrades";

/**
 * Binance Spot Trades Engine (Phase B)
 * Standardizes Binance 'aggTrade' streams to the unified Trade interface.
 */
export function useBinanceTrades(symbol: string): TradesState {
    const [state, setState] = useState<TradesState>({
        trades: [],
        isConnected: false,
        isLoading: true,
        error: null,
        provider: 'binance'
    });

    const wsRef = useRef<WebSocket | null>(null);
    const tradesBuffer = useRef<Trade[]>([]);
    const updateThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

    const binanceSymbol = symbol.toLowerCase().replace('/', '').replace('-', '');

    const scheduleUpdate = useCallback(() => {
        if (updateThrottle.current) return;
        updateThrottle.current = setTimeout(() => {
            updateThrottle.current = null;

            setState(prev => {
                const combined = [...tradesBuffer.current, ...prev.trades];
                tradesBuffer.current = [];

                return {
                    ...prev,
                    trades: combined.slice(0, 40),
                    isLoading: false
                };
            });
        }, 300);
    }, []);

    useEffect(() => {
        if (!symbol) {
            setState(prev => ({ ...prev, trades: [], isConnected: false, isLoading: false }));
            return;
        }

        // 1. Initial Fetch to warm up the state
        const fetchInitialTrades = async () => {
            try {
                const response = await fetch(`https://api.binance.com/api/v3/trades?symbol=${binanceSymbol.toUpperCase()}&limit=20`);
                const data = await response.json();
                if (Array.isArray(data)) {
                    const normalized = data.map((d: any) => ({
                        id: String(d.id),
                        side: (d.isBuyerMaker ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
                        price: d.price,
                        quantity: d.qty,
                        timestamp: d.time,
                        total: (parseFloat(d.price) * parseFloat(d.qty)).toString()
                    }));

                    setState(prev => ({
                        ...prev,
                        trades: normalized,
                        isLoading: false
                    }));
                }
            } catch (err) {
                console.error('[useBinanceTrades] Initial Fetch Error:', err);
            }
        };

        const connect = () => {
            const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${binanceSymbol}@aggTrade`);
            wsRef.current = ws;

            ws.onopen = () => setState(prev => ({ ...prev, isConnected: true }));

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const trade: Trade = {
                        id: String(data.a),
                        side: data.m ? 'SELL' : 'BUY',
                        price: data.p,
                        quantity: data.q,
                        timestamp: data.T,
                        total: (parseFloat(data.p) * parseFloat(data.q)).toString()
                    };

                    tradesBuffer.current = [trade, ...tradesBuffer.current];
                    scheduleUpdate();
                } catch (err) {
                    console.error('[useBinanceTrades] WS Error:', err);
                }
            };

            ws.onclose = () => setState(prev => ({ ...prev, isConnected: false }));
            ws.onerror = () => ws.close();
        };

        fetchInitialTrades();
        connect();

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (updateThrottle.current) clearTimeout(updateThrottle.current);
        };
    }, [binanceSymbol, symbol, scheduleUpdate]);

    return state;
}
