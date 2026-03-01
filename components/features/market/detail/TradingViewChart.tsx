import { colors } from '@/constants/colors';
import { useMarketTrades } from '@/hooks/useMarketTrades';
import { apiClient, BASE_URL } from '@/services/apiClient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { TIWILoader } from '@/components/ui/TIWILoader';

const imgArrowDown = "http://localhost:3845/assets/0e836a617eebbb1ad1003c8ec4eee1d931781d9a.svg";
const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D', 'More'];

/**
 * 🚀 TIWI INSTITUTIONAL CHART BRIDGE (V3 - BULLETPROOF)
 * Resolved: Pathing conflicts, formatting errors, and initialization hangs.
 */

// USE YOUR VERIFIED IP ADDRESS
const CHART_URL = `${BASE_URL}/charts/index.html`;

interface TradingViewChartProps {
    symbol: string;
    marketType?: 'spot' | 'perp';
    baseSymbol?: string;
    quoteSymbol?: string;
    precision?: number;
    price?: number;
    baseAddress?: string;
    quoteAddress?: string;
    chainId?: number;
    provider?: string;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
    symbol,
    marketType = 'spot',
    baseSymbol,
    quoteSymbol = 'USDT',
    precision,
    price,
    baseAddress,
    quoteAddress,
    chainId,
    provider
}) => {
    const webViewRef = useRef<WebView>(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
    const [isChartReady, setIsChartReady] = useState(false);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        setDebugLogs(prev => [msg.substring(0, 100), ...prev].slice(0, 5));
        console.log("[TV-WebView]:", msg);
    };

    const { trades } = useMarketTrades({ symbol, marketType, enabled: true });
    const lastTrade = trades?.[0];

    useEffect(() => {
        if (isChartReady && lastTrade) {
            const tradePrice = parseFloat(lastTrade.price);
            if (!isNaN(tradePrice)) {
                const bar = {
                    time: Math.floor(lastTrade.timestamp / 1000) * 1000,
                    close: tradePrice, open: tradePrice, high: tradePrice, low: tradePrice,
                    volume: parseFloat(lastTrade.quantity) || 0
                };
                webViewRef.current?.injectJavaScript(`if(window.updateLastPrice) window.updateLastPrice(${JSON.stringify(bar)});`);
            }
        }
    }, [lastTrade, isChartReady]);

    const tvSymbol = useMemo(() => {
        // For on-chain providers, the backend dispatcher REQUIRES the address-based pair format
        if (provider === 'onchain' && baseAddress && quoteAddress && chainId) {
            return `${baseAddress}-${quoteAddress}-${chainId}`;
        }
        return symbol.toUpperCase().replace('/', '-').replace('_', '-');
    }, [symbol, baseAddress, quoteAddress, chainId, provider]);

    const displayName = useMemo(() => (baseSymbol || symbol).split(/[-/]/)[0].toUpperCase(), [symbol, baseSymbol]);
    const tvInterval = useMemo(() => {
        const map: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1D': 'D' };
        return map[selectedTimeframe] || '60';
    }, [selectedTimeframe]);

    const handleMessage = async (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === 'LOG') {
                addLog(data.message);
                return;
            }

            if (data.type === 'ON_CHART_READY') {
                setIsChartReady(true);
                addLog("✅ Chart Engine Ready");
                return;
            }

            if (data.type === 'RESOLVE_SYMBOL') {
                let pricescale = 100;
                if (precision) pricescale = Math.pow(10, precision);
                else if (price && price < 1) pricescale = 100000000;

                const symbolData = {
                    name: symbol.includes('-USD') ? symbol : `${symbol}-USD`, // Show pretty name in chart legend
                    ticker: tvSymbol, // Use machine-readable (address or pair) for API calls
                    description: `${displayName}/${quoteSymbol}`,
                    type: 'crypto',
                    session: '24x7',
                    timezone: 'Etc/UTC',
                    exchange: marketType === 'perp' ? 'dYdX' : 'Binance',
                    minmov: 1,
                    pricescale: pricescale,
                    has_intraday: true,
                    supported_resolutions: ["1", "5", "15", "60", "240", "D"],
                };
                webViewRef.current?.injectJavaScript(`window.onNativeResponse({ requestId: "${data.id}", data: ${JSON.stringify(symbolData)} });`);
            }

            if (data.type === 'GET_BARS') {
                const history = await apiClient.getChartHistory({
                    symbol: tvSymbol,
                    resolution: data.resolution,
                    from: data.from,
                    to: data.to,
                    countback: data.countBack
                });

                // Support both UDF and Array formats
                let bars: any[] = [];
                if (history.t) {
                    bars = history.t.map((t: any, i: number) => ({
                        time: t * 1000, low: history.l[i], high: history.h[i],
                        open: history.o[i], close: history.c[i], volume: history.v?.[i] || 0
                    }));
                } else if (Array.isArray(history)) {
                    bars = history.map((b: any) => ({
                        time: (b.time || b.t) * 1000, open: b.open || b.o,
                        high: b.high || b.h, low: b.low || b.l,
                        close: b.close || b.c, volume: b.volume || b.v || 0
                    }));
                }

                webViewRef.current?.injectJavaScript(`window.onNativeResponse({ requestId: "${data.id}", data: ${JSON.stringify(bars)} });`);
            }
        } catch (e: any) {
            addLog("Error: " + e.message);
        }
    };

    const finalUrl = `${CHART_URL}?symbol=${tvSymbol}&interval=${tvInterval}&theme=dark`;

    return (
        <View style={styles.container}>
            <View style={styles.chartArea}>
                <WebView
                    ref={webViewRef}
                    key={tvSymbol}
                    source={{ uri: finalUrl }}
                    onMessage={handleMessage}
                    style={styles.webview}
                    domStorageEnabled={true}
                    javaScriptEnabled={true}
                    onHttpError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        addLog(`HTTP Error: ${nativeEvent.statusCode} at ${nativeEvent.url}`);
                    }}
                />
                {!isChartReady && (
                    <View style={styles.debugOverlay}>
                        <TIWILoader size={80} />
                        <Text style={styles.debugTitle}>LINKING TO TIWI ENGINE...</Text>
                        {debugLogs.map((log, i) => (
                            <Text key={i} style={styles.debugText}>› {log}</Text>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.timeframesWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeframesContainer}>
                    {timeframes.map((tf) => (
                        <TouchableOpacity key={tf} onPress={() => setSelectedTimeframe(tf)} style={styles.tfButton}>
                            <Text style={[styles.tfText, selectedTimeframe === tf && styles.tfTextActive]}>{tf}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', backgroundColor: '#010501' },
    chartArea: { width: '100%', height: 340, position: 'relative' },
    webview: { flex: 1, backgroundColor: '#010501' },
    debugOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(1, 5, 1, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    debugTitle: { color: colors.primaryCTA, marginBottom: 10, fontSize: 10, fontWeight: 'bold' },
    debugText: { color: '#666', fontSize: 9, textAlign: 'center' },
    timeframesWrapper: { borderBottomWidth: 1, borderBottomColor: colors.bgStroke },
    timeframesContainer: { paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', gap: 20 },
    tfButton: { padding: 4 },
    tfText: { fontSize: 12, color: colors.bodyText },
    tfTextActive: { color: colors.titleText, fontWeight: '600' },
});
