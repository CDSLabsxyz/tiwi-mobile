import { useCallback, useEffect, useRef, useState } from "react";
import { OrderbookState } from "./useBinanceOrderbook";
import { useDydxPollingOrderbook } from "./useDydxPollingOrderbook";

/**
 * Hybrid dYdX Orderbook Hook (v4 Optimized - Phase 5 Logic)
 * Implements Positional-First Normalization and Clean-Room Map Safety.
 */
export function useDydxOrderbook(market: string): OrderbookState {
    const [state, setState] = useState<OrderbookState>({
        bids: [],
        asks: [],
        currentPrice: 0,
        isConnected: false,
        isLoading: true,
        error: null,
        supported: true,
    });

    const [isFallbackActive, setIsFallbackActive] = useState(false);

    // Memory Layer: Persistent Maps for high-frequency updates
    const bidsMap = useRef<Map<string, string>>(new Map());
    const asksMap = useRef<Map<string, string>>(new Map());
    const wsRef = useRef<WebSocket | null>(null);
    const connectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const updateThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Snapshot Detection: v4 snapshots usually contain 100+ levels
    const hasAppliedSnapshot = useRef(false);

    // Normalize market
    let dydxMarket = market.toUpperCase().replace('_', '-').replace('/', '-');
    if (dydxMarket.includes('USDT')) dydxMarket = dydxMarket.replace('USDT', 'USD');
    if (dydxMarket && !dydxMarket.includes('-')) dydxMarket = `${dydxMarket}-USD`;

    const pollingState = useDydxPollingOrderbook(market, isFallbackActive);

    // Throttled Render Cycle
    const scheduleUpdate = useCallback(() => {
        if (updateThrottle.current) return;
        updateThrottle.current = setTimeout(() => {
            updateThrottle.current = null;

            // Normalize and Sort Bids (Highest Price First)
            const bids = Array.from(bidsMap.current.entries())
                .map(([p, s]) => {
                    const price = parseFloat(p) || 0;
                    const size = parseFloat(s) || 0;
                    return { price: p, quantity: s, total: (price * size).toString(), pVal: price };
                })
                .filter(b => b.pVal > 0)
                .sort((a, b) => b.pVal - a.pVal)
                .slice(0, 30);

            // Normalize and Sort Asks (Lowest Price First)
            const asks = Array.from(asksMap.current.entries())
                .map(([p, s]) => {
                    const price = parseFloat(p) || 0;
                    const size = parseFloat(s) || 0;
                    return { price: p, quantity: s, total: (price * size).toString(), pVal: price };
                })
                .filter(a => a.pVal > 0)
                .sort((a, b) => a.pVal - b.pVal)
                .slice(0, 30);

            setState(prev => {
                const bestBid = bids[0]?.pVal || 0;
                const bestAsk = asks[0]?.pVal || 0;
                const mid = (bestBid > 0 && bestAsk > 0) ? (bestBid + bestAsk) / 2 : (bestBid || bestAsk || prev.currentPrice);

                return {
                    ...prev,
                    bids: bids.map(({ pVal, ...rest }) => rest),
                    asks: asks.map(({ pVal, ...rest }) => rest),
                    currentPrice: mid,
                    isLoading: false,
                    error: null
                };
            });
        }, 300); // 300ms cycle for UI stability
    }, []);

    // Best Practice: Normalizer that handles both [price, size] and {price, size}
    const normalizeLevel = (l: any): [string, string] | null => {
        if (!l) return null;
        const price = l[0] ?? l.price;
        const size = l[1] ?? l.size;
        if (price === undefined || size === undefined) return null;
        return [String(price), String(size)];
    };

    const applyUpdates = useCallback((payload: { bids?: any[], asks?: any[] }, isSnapshot: boolean = false) => {
        if (isSnapshot) {
            bidsMap.current.clear();
            asksMap.current.clear();
        }

        (payload.bids || []).forEach(l => {
            const normalized = normalizeLevel(l);
            if (normalized) {
                const [p, s] = normalized;
                if (parseFloat(s) === 0) bidsMap.current.delete(p);
                else bidsMap.current.set(p, s);
            }
        });

        (payload.asks || []).forEach(l => {
            const normalized = normalizeLevel(l);
            if (normalized) {
                const [p, s] = normalized;
                if (parseFloat(s) === 0) asksMap.current.delete(p);
                else asksMap.current.set(p, s);
            }
        });

        scheduleUpdate();
    }, [scheduleUpdate]);

    const connectWs = useCallback(() => {
        if (!market) return;
        const ws = new WebSocket('wss://indexer.dydx.trade/v4/ws');
        wsRef.current = ws;

        connectionTimeout.current = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                setIsFallbackActive(true);
                ws.close();
            }
        }, 5000);

        ws.onopen = () => {
            if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
            setIsFallbackActive(false);
            hasAppliedSnapshot.current = false;
            setState(prev => ({ ...prev, isConnected: true }));

            ws.send(JSON.stringify({
                type: 'subscribe',
                channel: 'v4_orderbook',
                id: dydxMarket
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'channel_data' && data.contents) {
                    const { contents } = data;

                    // Unified Processing: v4 'contents' is usually an object {bids, asks}
                    // Snapshots are the first large payload. Updates are subsequents.
                    const isSnapshot = !hasAppliedSnapshot.current &&
                        ((contents.bids?.length || 0) + (contents.asks?.length || 0) > 20);

                    if (isSnapshot) hasAppliedSnapshot.current = true;

                    applyUpdates(contents, isSnapshot);
                }
            } catch (err) {
                console.error('[useDydxOrderbook] Parser Error:', err);
            }
        };

        ws.onclose = () => setIsFallbackActive(true);
        ws.onerror = () => setIsFallbackActive(true);
    }, [dydxMarket, market, applyUpdates]);

    useEffect(() => {
        setIsFallbackActive(false);
        connectWs();
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
            if (updateThrottle.current) clearTimeout(updateThrottle.current);
        };
    }, [connectWs]);

    return isFallbackActive ? pollingState : state;
}