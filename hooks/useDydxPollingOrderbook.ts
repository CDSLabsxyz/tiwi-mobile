import { API_URL } from "@/services/apiClient";
import { useEffect, useRef, useState } from "react";
import { OrderbookState } from "./useBinanceOrderbook";

/**
 * Fallback dYdX Polling Hook 
 * Fetches orderbook from our server API when WebSocket is blocked.
 */
export function useDydxPollingOrderbook(market: string, enabled: boolean = true): OrderbookState {
    const [state, setState] = useState<OrderbookState>({
        bids: [],
        asks: [],
        currentPrice: 0,
        isConnected: false,
        isLoading: true,
        error: null,
        supported: true,
    });

    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Normalize market (e.g. BTC-USD)
    let dydxMarket = market.toUpperCase().replace('_', '-').replace('/', '-');
    if (dydxMarket.includes('USDT')) {
        dydxMarket = dydxMarket.replace('USDT', 'USD');
    }
    if (dydxMarket && !dydxMarket.includes('-')) {
        dydxMarket = `${dydxMarket}-USD`;
    }

    useEffect(() => {
        if (!market || !enabled) {
            if (!enabled) setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        const fetchData = async () => {
            try {
                console.log("🚀 ~ fetchData ~ dydxMarket:", dydxMarket)
                // Call our server-side API (Absolute URL for mobile compatibility)
                const url = `${API_URL}/api/v1/dydx/orderbook/${dydxMarket}`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                // console.log("🚀 ~ fetchData ~ data:", data)

                setState({
                    bids: data.bids || [],
                    asks: data.asks || [],
                    currentPrice: data.currentPrice || 0,
                    isConnected: true, // We treat a successful poll as "connected" in this mode
                    isLoading: false,
                    error: null,
                    supported: true,
                });
            } catch (err) {
                console.error("[useDydxPollingOrderbook] Error:", err);
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    error: "Polling fallback active. Check network."
                }));
            }
        };

        fetchData();
        pollInterval.current = setInterval(fetchData, 2500); // Poll every 2.5s to be respectful

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [dydxMarket, enabled]);

    return state;
}
