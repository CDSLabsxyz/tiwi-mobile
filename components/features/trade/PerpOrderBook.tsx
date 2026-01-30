import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

const MOCK_ASKS = Array(8).fill({
    price: '54,980',
    quantity: '35.90K',
}).map((item, i) => ({ ...item, depth: 0.1 + (i * 0.1) }));

const MOCK_BIDS = Array(8).fill({
    price: '54,980',
    quantity: '35.90K',
}).map((item, i) => ({ ...item, depth: 0.1 + (i * 0.1) }));

export const PerpOrderBook = () => {
    return (
        <View style={styles.container}>
            {/* Fund Rate Section */}
            <View style={styles.fundRateContainer}>
                <Text style={styles.fundRateLabel}>Fund Rate / Countdown</Text>
                <Text style={styles.fundRateValue}>0.0012% / 00:59:29</Text>
            </View>

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerColLeft}>
                    <Text style={styles.headerText}>Price</Text>
                    <Text style={styles.subHeader}>(USDT)</Text>
                </View>
                <View style={styles.headerColRight}>
                    <Text style={styles.headerText}>Quantity</Text>
                    <Text style={styles.subHeader}>(USD)</Text>
                </View>
            </View>

            {/* Asks (Sells) */}
            <View style={styles.list}>
                {MOCK_ASKS.slice().reverse().map((item, i) => (
                    <View key={`ask-${i}`} style={styles.row}>
                        <View style={[styles.depthBar, {
                            backgroundColor: 'rgba(255, 92, 92, 0.12)',
                            width: `${item.depth * 100}%`
                        }]} />
                        <Text style={[styles.priceText, { color: colors.error }]}>{item.price}</Text>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                    </View>
                ))}
            </View>

            {/* Price Row */}
            <View style={styles.currentPriceContainer}>
                <Text style={styles.currentPrice}>0.051</Text>
                <Ionicons name="chevron-down" size={14} color={colors.mutedText} />
            </View>

            {/* Bids (Buys) */}
            <View style={styles.list}>
                {MOCK_BIDS.map((item, i) => (
                    <View key={`bid-${i}`} style={styles.row}>
                        <View style={[styles.depthBar, {
                            backgroundColor: 'rgba(63, 234, 155, 0.12)',
                            width: `${item.depth * 100}%`
                        }]} />
                        <Text style={[styles.priceText, { color: colors.success }]}>{item.price}</Text>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                    </View>
                ))}
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                <TouchableOpacity style={styles.depthSelector}>
                    <Text style={styles.depthText}>1</Text>
                    <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn}>
                    <Ionicons name="grid-outline" size={14} color={colors.primaryCTA} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    fundRateContainer: {
        alignItems: 'flex-end',
        marginBottom: 8,
    },
    fundRateLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 9,
        color: colors.mutedText,
    },
    fundRateValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.titleText,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    headerColLeft: {
        alignItems: 'flex-start',
    },
    headerColRight: {
        alignItems: 'flex-end',
    },
    headerText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    subHeader: {
        fontSize: 8,
        color: colors.mutedText,
        fontFamily: 'Manrope-Regular',
    },
    list: {
        gap: 2,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 18,
        position: 'relative',
    },
    depthBar: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        zIndex: -1,
    },
    priceText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 11,
        zIndex: 1,
    },
    qtyText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 11,
        color: colors.titleText,
        zIndex: 1,
    },
    currentPriceContainer: {
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    currentPrice: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    bottomControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    depthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.bgCards,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    depthText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.titleText,
    },
    gridBtn: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
