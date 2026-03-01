import { colors } from '@/constants/colors';
import { useMarketTrades } from '@/hooks/useMarketTrades';
import { formatCompactNumber } from '@/utils/formatting';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { MarketEmptyState } from './MarketEmptyState';

interface RecentTradesProps {
    symbol: string;
    marketType?: 'spot' | 'perp';
    quoteSymbol?: string;
}

/**
 * High-Performance Recent Trades List
 * Uses Batching and Throttling for institutional-grade reliability.
 */
export const RecentTrades: React.FC<RecentTradesProps> = ({
    symbol,
    marketType = 'spot',
    quoteSymbol = 'USDT'
}) => {
    const { trades, isConnected, isLoading, provider } = useMarketTrades({
        symbol,
        marketType,
    });

    const [showEmpty, setShowEmpty] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (trades.length === 0) {
                setShowEmpty(true);
            }
        }, 6000); // 6s threshold

        return () => clearTimeout(timer);
    }, [trades]);

    const formatPrice = (price: string) => {
        const val = parseFloat(price);
        if (isNaN(val)) return '--';
        return val.toLocaleString(undefined, {
            minimumFractionDigits: val < 1 ? 4 : 2,
            maximumFractionDigits: val < 1 ? 6 : 2
        });
    };

    const formatSize = (qty: string) => {
        const val = parseFloat(qty);
        if (isNaN(val)) return '--';
        if (val >= 1000) return formatCompactNumber(val);
        return val.toFixed(4);
    };

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleTimeString(undefined, {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    if (isLoading && trades.length === 0 && !showEmpty) {
        return (
            <View style={[styles.container, styles.center]}>
                <TIWILoader size={60} />
                <Text style={styles.loadingText}>SYNCING TRADES...</Text>
            </View>
        );
    }

    if (trades.length === 0 && showEmpty) {
        return <MarketEmptyState symbol={symbol} type="trades" />;
    }

    return (
        <View style={styles.container}>
            {/* Header Row */}
            <View style={styles.header}>
                <Text style={[styles.headerText, { flex: 2 }]}>Price ({quoteSymbol})</Text>
                <Text style={[styles.headerText, { flex: 1.2, textAlign: 'center' }]}>Size</Text>
                <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>Time</Text>
            </View>

            {/* Trades List */}
            <View style={styles.listContainer}>
                {trades.map((trade) => (
                    <View key={trade.id} style={styles.row}>
                        <Text style={[
                            styles.priceText,
                            { flex: 2, color: trade.side === 'BUY' ? colors.success : colors.error }
                        ]}>
                            {formatPrice(trade.price)}
                        </Text>
                        <Text style={[styles.sizeText, { flex: 1.2, textAlign: 'center' }]}>
                            {formatSize(trade.quantity)}
                        </Text>
                        <Text style={[styles.timeText, { flex: 1, textAlign: 'right' }]}>
                            {formatTime(trade.timestamp)}
                        </Text>
                    </View>
                ))}

                {trades.length === 0 && !isLoading && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No recent trades</Text>
                    </View>
                )}
            </View>

            {/* Connection Status Indicator */}
            <View style={styles.footer}>
                <View style={[styles.statusDot, isConnected ? styles.liveDot : styles.reconnectDot]} />
                <Text style={styles.footerText}>
                    {isConnected ? 'LIVE STREAM' : 'RECONNECTING...'}
                </Text>
            </View>
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
        minHeight: 250,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.mutedText,
        marginTop: 10,
        letterSpacing: 1,
    },
    header: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
        marginBottom: 4,
    },
    headerText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.mutedText,
        textTransform: 'uppercase',
    },
    listContainer: {
        minHeight: 100,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 32, // Professional spacing
    },
    priceText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
    },
    sizeText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.bodyText,
    },
    timeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    footer: {
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
    reconnectDot: {
        backgroundColor: colors.error,
    },
    footerText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 8,
        color: colors.mutedText,
        letterSpacing: 0.5,
    },
});
