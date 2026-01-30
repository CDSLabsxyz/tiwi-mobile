import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const imgArrowDown = "http://localhost:3845/assets/0e836a617eebbb1ad1003c8ec4eee1d931781d9a.svg";

interface OrderBookItem {
    price: string;
    quantity: string;
    depth: number; // 0 to 1
}

interface OrderBookProps {
    baseSymbol: string;
    quoteSymbol?: string;
    buyPressure?: number;
    sellPressure?: number;
}

// Mock data matching the design exactly
const MOCK_ORDERS = Array(15).fill({
    buyPrice: '54,980',
    sellPrice: '34,980',
    quantity: '35.90K',
}).map((item, i) => ({
    ...item,
    depth: i < 5 ? 0.05 : i < 10 ? (i - 4) * 0.15 : (i - 9) * 0.2 + 0.6
}));

export const OrderBook: React.FC<OrderBookProps> = ({
    baseSymbol,
    quoteSymbol = 'USDT',
    buyPressure = 80,
    sellPressure = 10
}) => {
    return (
        <View style={styles.container}>
            {/* Pressure Bar */}
            <View style={styles.pressureContainer}>
                <View style={styles.pressureLabels}>
                    <Text style={[styles.pressureValue, { color: colors.success }]}>{buyPressure}%</Text>
                    <Text style={[styles.pressureValue, { color: colors.error }]}>{sellPressure}%</Text>
                </View>
                <View style={styles.barWrapper}>
                    <View style={[styles.barBase, { backgroundColor: colors.error, width: '100%' }]} />
                    <View style={[styles.barBase, { backgroundColor: colors.success, width: `${buyPressure}%`, borderRadius: 100 }]} />
                </View>
            </View>

            {/* Main Tabs/Headers */}
            <View style={styles.headerRow}>
                <Text style={styles.headerLabel}>Buy</Text>
                <Text style={styles.headerLabel}>Sell</Text>
                <View style={styles.groupSelector}>
                    <Text style={styles.groupText}>1</Text>
                    <Image source={{ uri: imgArrowDown }} style={styles.arrowIcon} />
                </View>
            </View>

            {/* Column Headers */}
            <View style={styles.subHeader}>
                <Text style={[styles.subText, { textAlign: 'left', flex: 1 }]}>Qty ({baseSymbol})</Text>
                <Text style={[styles.subText, { textAlign: 'center', flex: 1.5 }]}>Price ({quoteSymbol})</Text>
                <Text style={[styles.subText, { textAlign: 'right', flex: 1 }]}>Qty ({baseSymbol})</Text>
            </View>

            {/* Orders List */}
            <View style={styles.list}>
                {MOCK_ORDERS.map((order, i) => (
                    <View key={i} style={styles.row}>
                        {/* Buy Depth */}
                        <View style={[styles.depthBar, {
                            width: `${order.depth * 50}%`,
                            backgroundColor: 'rgba(0, 194, 120, 0.15)',
                            left: 0,
                            borderTopRightRadius: 2,
                            borderBottomRightRadius: 2
                        }]} />

                        {/* Sell Depth */}
                        <View style={[styles.depthBar, {
                            width: `${order.depth * 50}%`,
                            backgroundColor: 'rgba(255, 61, 113, 0.15)',
                            right: 0,
                            borderTopLeftRadius: 2,
                            borderBottomLeftRadius: 2
                        }]} />

                        <Text style={[styles.qtyText, { textAlign: 'left', flex: 1 }]}>{order.quantity}</Text>

                        <View style={styles.priceContainer}>
                            <Text style={[styles.priceText, { color: colors.success }]}>{order.buyPrice}</Text>
                            <Text style={[styles.priceText, { color: colors.error }]}>{order.sellPrice}</Text>
                        </View>

                        <Text style={[styles.qtyText, { textAlign: 'right', flex: 1 }]}>{order.quantity}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    pressureContainer: {
        paddingVertical: 12,
    },
    pressureLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    pressureValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    barWrapper: {
        height: 6,
        borderRadius: 100,
        overflow: 'hidden',
        position: 'relative',
    },
    barBase: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 20,
    },
    headerLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.bodyText,
    },
    groupSelector: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 6,
    },
    groupText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.titleText,
    },
    arrowIcon: {
        width: 12,
        height: 12,
        tintColor: colors.bodyText,
    },
    subHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
        marginBottom: 4,
    },
    subText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    list: {
        gap: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
        position: 'relative',
    },
    depthBar: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        zIndex: 0,
    },
    qtyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.titleText,
        zIndex: 1,
    },
    priceContainer: {
        flex: 1.5,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        zIndex: 1,
    },
    priceText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
});
