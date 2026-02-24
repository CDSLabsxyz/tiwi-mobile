import { colors } from '@/constants/colors';
import { useOrderBook } from '@/hooks/useOrderBook';
import { formatCompactNumber } from '@/utils/formatting';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MarketEmptyState } from './MarketEmptyState';

const imgArrowDown = "http://localhost:3845/assets/0e836a617eebbb1ad1003c8ec4eee1d931781d9a.svg";

interface OrderBookProps {
    symbol: string;
    address?: string;
    chainId?: number;
    marketType?: 'spot' | 'perp';
    baseSymbol: string;
    quoteSymbol?: string;
}

/**
 * Symmetric OrderBook (Vertical Valley Design)
 * 
 * Layout:
 * [Qty Bid] [Price Bid (Green)] | [Price Ask (Red)] [Qty Ask]
 * 
 * Visualization:
 * Cumulative depth bars meeting in the center spread.
 */
export const OrderBook: React.FC<OrderBookProps> = ({
    symbol,
    address,
    chainId,
    marketType = 'spot',
    baseSymbol,
    quoteSymbol = 'USDT'
}) => {
    const { data, isLoading, isError, isConnected, provider, error } = useOrderBook({
        symbol,
        address,
        chainId,
        marketType,
    });

    const processedData = useMemo(() => {
        if (!data) return { bids: [], asks: [], maxTotal: 1, buyPressure: 50 };

        // Take more rows for a deep professional look
        const bids = (data.bids || []).slice(0, 20);
        const asks = (data.asks || []).slice(0, 20);

        // Sort asks so best ask (lowest price) is at the end of the array 
        // if we want to reverse them for the "spread at bottom" view.
        // Actually, for the symmetric side-by-side rows:
        // Best Bid (highest price) should be on the first row.
        // Best Ask (lowest price) should be on the first row.
        // This makes the "center valley" start at the top? 
        // No, standard trading apps put the spread in the middle of a vertical list, 
        // OR as the first row if it's a split view.
        // The screenshot shows the spread at the TOP or BOTTOM? 
        // Usually, best prices are closest to the center headers.

        // Calculate Cumulative Totals for center-out visualization
        let cumulativeBid = 0;
        const bidsWithDepth = bids.map(b => {
            const vol = parseFloat(b.total) || 0;
            cumulativeBid += vol;
            return { ...b, cumulativeTotal: cumulativeBid };
        });

        let cumulativeAsk = 0;
        const asksWithDepth = asks.map(a => {
            const vol = parseFloat(a.total) || 0;
            cumulativeAsk += vol;
            return { ...a, cumulativeTotal: cumulativeAsk };
        });

        const maxTotal = Math.max(cumulativeBid, cumulativeAsk, 1);

        // Buy/Sell Pressure
        const top5Buy = bids.slice(0, 5).reduce((acc, b) => acc + (parseFloat(b.total) || 0), 0);
        const top5Sell = asks.slice(0, 5).reduce((acc, a) => acc + (parseFloat(a.total) || 0), 0);
        const total = top5Buy + top5Sell;
        const buyPressure = total > 0 ? Math.round((top5Buy / total) * 100) : 50;

        return { bids: bidsWithDepth, asks: asksWithDepth, maxTotal, buyPressure };
    }, [data]);

    const formatPrice = (price: string) => {
        const val = parseFloat(price);
        if (isNaN(val)) return '--';
        return val.toLocaleString(undefined, {
            minimumFractionDigits: val < 1 ? 4 : 2,
            maximumFractionDigits: val < 1 ? 6 : 2
        });
    };

    const formatQty = (qty: string) => {
        const val = parseFloat(qty);
        if (isNaN(val)) return '--';
        if (val >= 1000) return formatCompactNumber(val);
        return val.toFixed(2);
    };

    const [showEmpty, setShowEmpty] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (!data || (data.bids.length === 0 && data.asks.length === 0)) {
                setShowEmpty(true);
            }
        }, 6000); // 6s threshold

        return () => clearTimeout(timer);
    }, [data]);

    if (isLoading && !data && !showEmpty) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator color={colors.primaryCTA} size="small" />
                <Text style={styles.loadingText}>Connecting...</Text>
            </View>
        );
    }

    if ((!data || (data.bids.length === 0 && data.asks.length === 0)) && showEmpty) {
        return <MarketEmptyState symbol={symbol} type="order book" />;
    }

    const { bids, asks, maxTotal, buyPressure } = processedData;
    const sellPressure = 100 - buyPressure;

    // Paired rows: Best Bid and Best Ask on the first row
    const rowCount = Math.max(bids.length, asks.length);
    const rows = Array.from({ length: rowCount }).map((_, i) => ({
        bid: bids[i] || null,
        ask: asks[i] || null,
    }));

    return (
        <View style={styles.container}>
            {/* 1. Pressure Bar Section */}
            <View style={styles.pressureArea}>
                <View style={styles.pressureNumbers}>
                    <Text style={[styles.pressureLabel, { color: colors.success }]}>{buyPressure}%</Text>
                    <Text style={[styles.pressureLabel, { color: colors.error }]}>{sellPressure}%</Text>
                </View>
                <View style={styles.pressureTrack}>
                    <View style={[styles.pressureFill, { width: `${buyPressure}%`, backgroundColor: colors.success }]} />
                    <View style={[styles.pressureFill, { width: `${sellPressure}%`, backgroundColor: colors.error, right: 0, position: 'absolute' }]} />
                </View>
            </View>

            {/* 2. Top Labels: Buy, Sell, and Multiplier */}
            <View style={styles.labelsWrapper}>
                <Text style={styles.topLabel}>Buy</Text>
                <Text style={styles.topLabel}>Sell</Text>
                <View style={styles.depthSelector}>
                    <Text style={styles.selectorText}>1</Text>
                    <Image source={{ uri: imgArrowDown }} style={styles.arrowIcon} />
                </View>
            </View>

            {/* 3. Column Headers */}
            <View style={styles.headerRow}>
                <Text style={[styles.headerText, { textAlign: 'left', flex: 1 }]}>Qty ({baseSymbol})</Text>
                <Text style={[styles.headerText, { textAlign: 'center', flex: 2.2 }]}>Price ({quoteSymbol})</Text>
                <Text style={[styles.headerText, { textAlign: 'right', flex: 1 }]}>Qty ({baseSymbol})</Text>
            </View>

            {/* 4. Symmetric List */}
            <View style={styles.listContainer}>
                {rows.map((row, i) => {
                    // Cumulative depth width
                    const bidBarWidth = row.bid ? (row.bid.cumulativeTotal / maxTotal) * 100 : 0;
                    const askBarWidth = row.ask ? (row.ask.cumulativeTotal / maxTotal) * 100 : 0;

                    return (
                        <View key={i} style={styles.dataRow}>
                            {/* Bid Side Depth (Grows from center to left) */}
                            <View style={[styles.halfRow, { left: 0 }]}>
                                {row.bid && (
                                    <View style={[styles.depthBar, {
                                        width: `${bidBarWidth}%`,
                                        backgroundColor: 'rgba(63, 234, 155, 0.08)',
                                        right: 0
                                    }]} />
                                )}
                            </View>

                            {/* Ask Side Depth (Grows from center to right) */}
                            <View style={[styles.halfRow, { right: 0 }]}>
                                {row.ask && (
                                    <View style={[styles.depthBar, {
                                        width: `${askBarWidth}%`,
                                        backgroundColor: 'rgba(255, 92, 92, 0.08)',
                                        left: 0
                                    }]} />
                                )}
                            </View>

                            {/* Content Columns */}
                            <Text style={[styles.valText, { flex: 1, textAlign: 'left', color: colors.bodyText }]}>
                                {row.bid ? formatQty(row.bid.quantity) : ''}
                            </Text>

                            <View style={styles.priceCenter}>
                                <Text style={[styles.priceText, { color: colors.success, textAlign: 'right' }]}>
                                    {row.bid ? formatPrice(row.bid.price) : ''}
                                </Text>
                                <Text style={[styles.priceText, { color: colors.error, textAlign: 'left' }]}>
                                    {row.ask ? formatPrice(row.ask.price) : ''}
                                </Text>
                            </View>

                            <Text style={[styles.valText, { flex: 1, textAlign: 'right', color: colors.bodyText }]}>
                                {row.ask ? formatQty(row.ask.quantity) : ''}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* 5. Connection Status (Footer style) */}
            {/* <View style={styles.footerStatus}>
                <View style={[styles.statusDot, isConnected ? styles.liveDot : styles.offlineDot]} />
                <Text style={styles.footerText}>{isConnected ? 'LIVE CONNECTION' : 'RECONNECTING...'}</Text>
                <Text style={styles.providerInfo}>{provider?.toUpperCase()}</Text>
            </View> */}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    center: {
        minHeight: 300,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.mutedText,
        marginTop: 10,
        letterSpacing: 1,
    },
    pressureArea: {
        paddingVertical: 12,
    },
    pressureNumbers: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    pressureLabel: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
    },
    pressureTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
    },
    pressureFill: {
        height: '100%',
        borderRadius: 2,
    },
    labelsWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    topLabel: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
        flex: 1,
        // center the Sell label relative to its side
    },
    depthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        gap: 4,
    },
    selectorText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.titleText,
    },
    arrowIcon: {
        width: 10,
        height: 10,
        tintColor: colors.bodyText,
    },
    headerRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    headerText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.mutedText,
        textTransform: 'uppercase',
    },
    listContainer: {
        paddingVertical: 4,
    },
    dataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 22, // Keep it compact
        position: 'relative',
        marginVertical: 1,
    },
    halfRow: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '50%',
    },
    depthBar: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        zIndex: 0,
    },
    valText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        zIndex: 1,
    },
    priceCenter: {
        flex: 2.2,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        zIndex: 1,
    },
    priceText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        width: '45%',
    },
    footerStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 16,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    liveDot: {
        backgroundColor: colors.success,
    },
    offlineDot: {
        backgroundColor: colors.error,
    },
    footerText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 8,
        color: colors.mutedText,
        letterSpacing: 0.5,
    },
    providerInfo: {
        marginLeft: 'auto',
        fontFamily: 'Manrope-ExtraBold',
        fontSize: 8,
        color: colors.primaryCTA,
    },
});
