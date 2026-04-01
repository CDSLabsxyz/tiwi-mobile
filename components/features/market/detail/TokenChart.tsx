import { colors } from '@/constants/colors';
import { TIWILoader } from '@/components/ui/TIWILoader';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart, CandlestickChart } from 'react-native-wagmi-charts';

const API_BASE = 'https://app.tiwiprotocol.xyz/api/v1/charts/token';
const RANGES = ['1H', '4H', '1D', '1W', '1M', '3M', '1Y'] as const;
const SCREEN_WIDTH = Dimensions.get('window').width;

type ChartMode = 'line' | 'candle';

interface TokenChartProps {
    baseToken: string;
    chainId: number;
    tokenSymbol?: string;
}

export const TokenChart: React.FC<TokenChartProps> = ({ baseToken, chainId, tokenSymbol }) => {
    const [range, setRange] = useState<string>('1D');
    const [mode, setMode] = useState<ChartMode>('line');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lineData, setLineData] = useState<{ timestamp: number; value: number }[]>([]);
    const [candleData, setCandleData] = useState<{ timestamp: number; open: number; high: number; low: number; close: number }[]>([]);
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        const url = `${API_BASE}?baseToken=${encodeURIComponent(baseToken)}&chainId=${chainId}&range=${range}&quoteToken=USD`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;

                if (!data.success && data.status !== 'ok' && data.status !== 'synthetic') {
                    setError('Chart data unavailable');
                    setLoading(false);
                    return;
                }

                // Line chart data from points
                const points = (data.points || [])
                    .filter((p: any) => p.value > 0)
                    .map((p: any) => ({
                        timestamp: p.time,
                        value: p.value,
                    }));
                setLineData(points);

                // Candlestick data from bars
                const candles = (data.bars || [])
                    .filter((b: any) => b.close > 0)
                    .map((b: any) => ({
                        timestamp: b.time,
                        open: b.open,
                        high: b.high,
                        low: b.low,
                        close: b.close,
                    }));
                setCandleData(candles);
                setSummary(data.summary);
                setLoading(false);
            })
            .catch(e => {
                if (!cancelled) {
                    setError(e.message);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [baseToken, chainId, range]);

    const changePercent = summary?.changePercent ?? 0;
    const isPositive = changePercent >= 0;
    const chartColor = isPositive ? '#22C55E' : '#EF4444';

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <TIWILoader size={60} />
            </View>
        );
    }

    if (error || lineData.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>{error || 'No chart data available'}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Chart */}
            <View style={styles.chartWrapper}>
                {mode === 'line' && lineData.length > 1 ? (
                    <LineChart.Provider data={lineData}>
                        <LineChart width={SCREEN_WIDTH} height={280}>
                            <LineChart.Path color={chartColor} width={2}>
                                <LineChart.Gradient color={chartColor} />
                            </LineChart.Path>
                            <LineChart.CursorCrosshair color={chartColor}>
                                <LineChart.Tooltip
                                    textStyle={{ color: '#FFFFFF', fontFamily: 'Manrope-Bold', fontSize: 12 }}
                                    style={{ backgroundColor: '#1F261E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
                                />
                            </LineChart.CursorCrosshair>
                        </LineChart>
                    </LineChart.Provider>
                ) : candleData.length > 1 ? (
                    <CandlestickChart.Provider data={candleData}>
                        <CandlestickChart width={SCREEN_WIDTH} height={280}>
                            <CandlestickChart.Candles positiveColor="#22C55E" negativeColor="#EF4444" />
                            <CandlestickChart.Crosshair color={colors.primaryCTA}>
                                <CandlestickChart.Tooltip
                                    textStyle={{ color: '#FFFFFF', fontFamily: 'Manrope-Medium', fontSize: 11 }}
                                    style={{ backgroundColor: '#1F261E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
                                />
                            </CandlestickChart.Crosshair>
                        </CandlestickChart>
                    </CandlestickChart.Provider>
                ) : (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.errorText}>Not enough data points</Text>
                    </View>
                )}
            </View>

            {/* Range selector */}
            <View style={styles.controlsRow}>
                <View style={styles.rangeRow}>
                    {RANGES.map(r => (
                        <TouchableOpacity
                            key={r}
                            onPress={() => setRange(r)}
                            style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
                        >
                            <Text style={[styles.rangeTxt, range === r && styles.rangeTxtActive]}>{r}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Chart mode toggle */}
                <View style={styles.modeRow}>
                    <TouchableOpacity
                        onPress={() => setMode('line')}
                        style={[styles.modeBtn, mode === 'line' && styles.modeBtnActive]}
                    >
                        <Text style={[styles.modeTxt, mode === 'line' && styles.modeTxtActive]}>Line</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setMode('candle')}
                        style={[styles.modeBtn, mode === 'candle' && styles.modeBtnActive]}
                    >
                        <Text style={[styles.modeTxt, mode === 'candle' && styles.modeTxtActive]}>Candle</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: colors.bg,
    },
    chartWrapper: {
        width: '100%',
        height: 280,
    },
    loadingContainer: {
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#888',
        fontSize: 13,
        fontFamily: 'Manrope-Medium',
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    rangeRow: {
        flexDirection: 'row',
        gap: 4,
    },
    rangeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    rangeBtnActive: {
        backgroundColor: '#1F261E',
    },
    rangeTxt: {
        color: '#666',
        fontSize: 12,
        fontFamily: 'Manrope-SemiBold',
    },
    rangeTxtActive: {
        color: colors.titleText,
    },
    modeRow: {
        flexDirection: 'row',
        gap: 4,
    },
    modeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    modeBtnActive: {
        backgroundColor: '#1F261E',
    },
    modeTxt: {
        color: '#666',
        fontSize: 11,
        fontFamily: 'Manrope-Medium',
    },
    modeTxtActive: {
        color: colors.primaryCTA,
    },
});
