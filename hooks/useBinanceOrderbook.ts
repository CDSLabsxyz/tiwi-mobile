"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface OrderBookLevel {
  price: string;
  quantity: string;
  total: string;
}

export interface OrderbookState {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  currentPrice: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  supported: boolean;
}

/**
 * Format price with appropriate decimal places
 */
function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toFixed(8);
}

/**
 * Format quantity with appropriate decimal places
 */
function formatQuantity(qty: number): string {
  if (qty >= 1000) return qty.toFixed(2);
  if (qty >= 1) return qty.toFixed(4);
  return qty.toFixed(6);
}

/**
 * Normalize symbol for Binance: "XRP-USDT" -> "xrpusdt" (lowercase for WS)
 */
function normalizeSymbol(pair: string): string {
  return pair.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Convert Map-based orderbook to sorted OrderBookLevel array
 */
function mapToLevels(
  map: Map<string, string>,
  side: "bids" | "asks",
  limit: number = 30
): OrderBookLevel[] {
  const entries = Array.from(map.entries())
    .filter(([, qty]) => parseFloat(qty) > 0) // Remove zero-quantity levels
    .map(([price, quantity]) => ({
      priceNum: parseFloat(price),
      qtyNum: parseFloat(quantity),
      price,
      quantity,
    }));

  // Bids: highest price first; Asks: lowest price first
  if (side === "bids") {
    entries.sort((a, b) => b.priceNum - a.priceNum);
  } else {
    entries.sort((a, b) => a.priceNum - b.priceNum);
  }

  return entries.slice(0, limit).map(({ priceNum, qtyNum }) => ({
    price: formatPrice(priceNum),
    quantity: formatQuantity(qtyNum),
    total: formatQuantity(priceNum * qtyNum),
  }));
}

/**
 * Custom hook for real-time Binance orderbook via WebSocket
 *
 * Flow:
 * 1. Fetch REST snapshot from Binance
 * 2. Connect to WebSocket for live depth diffs
 * 3. Apply diffs to local orderbook Map
 * 4. Return formatted bids/asks arrays
 */
export function useBinanceOrderbook(
  baseSymbol: string,
  quoteSymbol: string,
  marketType: "spot" | "perp" = "spot"
): OrderbookState {
  const [state, setState] = useState<OrderbookState>({
    bids: [],
    asks: [],
    currentPrice: 0,
    isConnected: false,
    isLoading: true,
    error: null,
    supported: true,
  });

  const bidsMap = useRef<Map<string, string>>(new Map());
  const asksMap = useRef<Map<string, string>>(new Map());
  const lastUpdateId = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<any[]>([]); // Buffer WS events until snapshot is applied
  const snapshotApplied = useRef<boolean>(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const symbol = normalizeSymbol(`${baseSymbol}${quoteSymbol}`);

  // Handle special perp symbols
  const getSymbol = useCallback(() => {
    let s = symbol;
    if (marketType === "perp") {
      if (s === "shibusdt") s = "1000shibusdt";
      if (s === "flokiusdt") s = "1000flokiusdt";
    }
    return s;
  }, [symbol, marketType]);

  // Throttled state update to avoid excessive re-renders
  const scheduleUpdate = useCallback(() => {
    if (updateThrottle.current) return;
    updateThrottle.current = setTimeout(() => {
      updateThrottle.current = null;

      const bids = mapToLevels(bidsMap.current, "bids");
      const asks = mapToLevels(asksMap.current, "asks");

      // Crossed Book Check: Safety for fast markets
      if (bids.length > 0 && asks.length > 0) {
        const bestBid = parseFloat(bids[0].price);
        const bestAsk = parseFloat(asks[0].price); // mapToLevels sorted asks ASC
        if (bestBid >= bestAsk) {
          // We don't remove levels here (snapshot-diff will correct it)
          // but we warn so we know the data source has high latency
          console.warn("[useBinanceOrderbook] Crossed book detected");
        }
      }

      // Asks should display highest first (reversed for UI: highest at top, lowest near spread)
      asks.reverse();

      // Current price = midpoint between best bid and best ask
      let currentPrice = 0;
      if (bids.length > 0 && asks.length > 0) {
        const bestBid = parseFloat(bids[0].price);
        const bestAsk = parseFloat(asks[asks.length - 1].price); // lowest ask (nearest spread)
        currentPrice = (bestBid + bestAsk) / 2;
      } else if (bids.length > 0) {
        currentPrice = parseFloat(bids[0].price);
      } else if (asks.length > 0) {
        currentPrice = parseFloat(asks[asks.length - 1].price);
      }

      setState((prev) => ({
        ...prev,
        bids,
        asks,
        currentPrice,
        supported: true,
      }));
    }, 200); // Update UI at most every 200ms
  }, []);

  // Apply a depth update (from WS or snapshot)
  const applyUpdate = useCallback(
    (bids: [string, string][], asks: [string, string][]) => {
      for (const [price, qty] of bids) {
        if (parseFloat(qty) === 0) {
          bidsMap.current.delete(price);
        } else {
          bidsMap.current.set(price, qty);
        }
      }
      for (const [price, qty] of asks) {
        if (parseFloat(qty) === 0) {
          asksMap.current.delete(price);
        } else {
          asksMap.current.set(price, qty);
        }
      }
      scheduleUpdate();
    },
    [scheduleUpdate]
  );

  useEffect(() => {
    // Return early if symbols are empty (prevents errors when prioritized provider is dYdX)
    if (!baseSymbol || !quoteSymbol || baseSymbol === '' || quoteSymbol === '') {
      return;
    }

    const wsSymbol = getSymbol();
    console.log("[useBinanceOrderbook] Starting for:", wsSymbol, marketType);

    // Reset state
    bidsMap.current.clear();
    asksMap.current.clear();
    lastUpdateId.current = 0;
    snapshotApplied.current = false;
    bufferRef.current = [];
    setState({
      bids: [],
      asks: [],
      currentPrice: 0,
      isConnected: false,
      isLoading: true,
      error: null,
      supported: true,
    });

    // Determine endpoints based on market type
    const restBase =
      marketType === "perp"
        ? "https://fapi.binance.com/fapi/v1"
        : "https://api.binance.com/api/v3";
    const wsBase =
      marketType === "perp"
        ? "wss://fstream.binance.com/ws"
        : "wss://stream.binance.com:9443/ws";

    const restSymbol = wsSymbol.toUpperCase();

    let isCancelled = false;

    // Step 1: Connect WebSocket first (buffer events)
    const wsUrl = `${wsBase}/${wsSymbol}@depth`;
    console.log("[useBinanceOrderbook] Connecting WS:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[useBinanceOrderbook] WS connected");
      if (!isCancelled) {
        setState((prev) => ({ ...prev, isConnected: true }));
      }
    };

    ws.onmessage = (event) => {
      if (isCancelled) return;
      try {
        const data = JSON.parse(event.data);

        if (!snapshotApplied.current) {
          // Buffer events until snapshot is applied
          bufferRef.current.push(data);
          return;
        }

        // Drop events older than our snapshot
        const finalUpdateId = data.u; // "u" = final update ID
        if (finalUpdateId <= lastUpdateId.current) return;

        // Apply the diff
        applyUpdate(data.b || [], data.a || []);
        lastUpdateId.current = finalUpdateId;
      } catch (err) {
        console.error("[useBinanceOrderbook] WS message error:", err);
      }
    };

    ws.onerror = (event) => {
      console.error("[useBinanceOrderbook] WS error:", event);
      if (!isCancelled) {
        setState((prev) => ({
          ...prev,
          error: "WebSocket connection error",
          isConnected: false,
        }));
      }
    };

    ws.onclose = () => {
      console.log("[useBinanceOrderbook] WS closed");
      if (!isCancelled) {
        setState((prev) => ({ ...prev, isConnected: false }));
        // Reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(() => {
          // The effect cleanup + re-run handles reconnection
          // by changing a dummy state or re-triggering
        }, 3000);
      }
    };

    // Step 2: Fetch REST snapshot
    const fetchSnapshot = async () => {
      try {
        const url = `${restBase}/depth?symbol=${restSymbol}&limit=1000`;
        console.log("[useBinanceOrderbook] Fetching snapshot:", url);

        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error(
            "[useBinanceOrderbook] Snapshot error:",
            response.status,
            errorText
          );

          // Check if pair is not supported
          if (response.status === 400) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              supported: false,
              error: `${baseSymbol}/${quoteSymbol} not available on Binance ${marketType}`,
            }));
            return;
          }

          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: `Failed to fetch orderbook (${response.status})`,
          }));
          return;
        }

        const data = await response.json();
        console.log(
          "[useBinanceOrderbook] Snapshot received:",
          "bids:",
          data.bids?.length,
          "asks:",
          data.asks?.length,
          "lastUpdateId:",
          data.lastUpdateId
        );

        if (isCancelled) return;

        // Apply snapshot
        bidsMap.current.clear();
        asksMap.current.clear();

        for (const [price, qty] of data.bids || []) {
          bidsMap.current.set(price, qty);
        }
        for (const [price, qty] of data.asks || []) {
          asksMap.current.set(price, qty);
        }

        lastUpdateId.current = data.lastUpdateId;
        snapshotApplied.current = true;

        // Apply buffered WebSocket events
        const buffered = bufferRef.current;
        bufferRef.current = [];

        for (const event of buffered) {
          const finalUpdateId = event.u;
          if (finalUpdateId <= lastUpdateId.current) continue;
          applyUpdate(event.b || [], event.a || []);
          lastUpdateId.current = finalUpdateId;
        }

        setState((prev) => ({ ...prev, isLoading: false }));
        scheduleUpdate();
      } catch (err: any) {
        console.error("[useBinanceOrderbook] Snapshot fetch error:", err);
        if (!isCancelled) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err.message || "Failed to fetch orderbook",
          }));
        }
      }
    };

    // Small delay to let WS connect and buffer initial events
    const snapshotTimer = setTimeout(fetchSnapshot, 500);

    // Cleanup
    return () => {
      isCancelled = true;
      clearTimeout(snapshotTimer);
      if (updateThrottle.current) clearTimeout(updateThrottle.current);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [baseSymbol, quoteSymbol, marketType, getSymbol, applyUpdate, scheduleUpdate]);

  return state;
}
