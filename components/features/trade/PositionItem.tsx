import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PositionItemProps {
    symbol: string;
    side: 'long' | 'short';
    leverage: string;
    marginMode: string;
    unrealizedPnl: string;
    roi: string;
    value: string;
    margin: string;
    risk: string;
    entryPrice: string;
    markPrice: string;
    liqPrice: string;
    isPositive: boolean;
}

export const PositionItem: React.FC<PositionItemProps> = (props) => {
    const pnlColor = props.isPositive ? colors.success : colors.error;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.tokenInfo}>
                    <View style={styles.symbolRow}>
                        <Text style={styles.symbolText}>{props.symbol}</Text>
                        <Text style={styles.quoteText}>/USDT</Text>
                    </View>
                    <Text style={styles.metaText}>Perp / {props.marginMode} {props.leverage}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: props.side === 'long' ? colors.success : colors.error }]}>
                    <Text style={styles.badgeText}>{props.side === 'long' ? 'Buy' : 'Sell'}</Text>
                </View>
            </View>

            {/* PNL Row */}
            <View style={styles.pnlContainer}>
                <View>
                    <Text style={styles.label}>Unrealized PnL</Text>
                    <Text style={[styles.pnlValue, { color: pnlColor }]}>{props.unrealizedPnl}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.label}>ROI</Text>
                    <Text style={[styles.roiValue, { color: pnlColor }]}>{props.roi}</Text>
                </View>
            </View>

            {/* Details Grid */}
            <View style={styles.grid}>
                <View style={styles.gridItem}>
                    <Text style={styles.label}>Value</Text>
                    <Text style={styles.value}>${props.value}</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.label}>Margin</Text>
                    <Text style={styles.value}>${props.margin}</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.label}>Risk</Text>
                    <Text style={styles.value}>{props.risk}</Text>
                </View>
            </View>

            <View style={[styles.grid, { marginTop: 12 }]}>
                <View style={styles.gridItem}>
                    <Text style={styles.label}>Ent. Price</Text>
                    <Text style={styles.value}>${props.entryPrice}</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.label}>Last Price</Text>
                    <Text style={styles.value}>${props.markPrice}</Text>
                </View>
                <View style={styles.gridItem}>
                    <Text style={styles.label}>Liq. Price</Text>
                    <Text style={styles.value}>${props.liqPrice}</Text>
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>Adjust Leverage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.closeBtn]}>
                    <Text style={styles.actionBtnText}>Close Position</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    tokenInfo: {
        gap: 2,
    },
    symbolRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    symbolText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    quoteText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.mutedText,
    },
    metaText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    badgeText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 11,
        color: '#000',
    },
    pnlContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.mutedText,
        marginBottom: 4,
    },
    pnlValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
    },
    roiValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    gridItem: {
        flex: 1,
    },
    value: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
        color: colors.titleText,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    actionBtn: {
        flex: 1,
        height: 40,
        borderRadius: 8,
        backgroundColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        backgroundColor: 'rgba(255, 92, 92, 0.1)',
    },
    actionBtnText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
        color: colors.titleText,
    },
});
