import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TradeItem {
    price: string;
    size: string;
    time: string;
    side: 'buy' | 'sell';
}

// Mock data matching the design
const MOCK_TRADES: TradeItem[] = [
    { price: '34,980.50', size: '0.045', time: '12:05:01', side: 'buy' },
    { price: '34,980.50', size: '1.200', time: '12:05:00', side: 'sell' },
    { price: '34,979.20', size: '0.150', time: '12:04:58', side: 'buy' },
    { price: '34,979.00', size: '0.010', time: '12:04:55', side: 'sell' },
    { price: '34,981.10', size: '2.500', time: '12:04:52', side: 'buy' },
    { price: '34,980.80', size: '0.340', time: '12:04:50', side: 'buy' },
    { price: '34,980.50', size: '0.045', time: '12:05:01', side: 'buy' },
    { price: '34,980.50', size: '1.200', time: '12:05:00', side: 'sell' },
];

export const RecentTrades: React.FC = () => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.headerText, { flex: 2 }]}>Price (USDT)</Text>
                <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>Size</Text>
                <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>Time</Text>
            </View>

            {MOCK_TRADES.map((trade, i) => (
                <View key={i} style={styles.row}>
                    <Text style={[
                        styles.priceText,
                        { flex: 2, color: trade.side === 'buy' ? colors.success : colors.error }
                    ]}>
                        {trade.price}
                    </Text>
                    <Text style={[styles.sizeText, { flex: 1, textAlign: 'center' }]}>{trade.size}</Text>
                    <Text style={[styles.timeText, { flex: 1, textAlign: 'right' }]}>{trade.time}</Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    header: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
        marginBottom: 8,
    },
    headerText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    priceText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
    },
    sizeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.titleText,
    },
    timeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
});
