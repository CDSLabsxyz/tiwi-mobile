import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TokenTransactionsSummaryProps {
    total: number;
    buys: number;
    sells: number;
}

export const TokenTransactionsSummary: React.FC<TokenTransactionsSummaryProps> = ({
    total,
    buys,
    sells
}) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>24h Transactions</Text>
            <View style={styles.header}>
                <Text style={styles.totalValue}>{total.toLocaleString()}</Text>
                <Text style={styles.totalLabel}>total</Text>
            </View>
            <View style={styles.barsContainer}>
                <View style={[styles.barWrapper, { flex: 1 }]}>
                    <View style={styles.barHeader}>
                        <Text style={styles.buyLabel}>Buys</Text>
                        <Text style={styles.buyValue}>{buys.toLocaleString()}</Text>
                    </View>
                    <View style={styles.barBackground}>
                        <View 
                            style={[
                                styles.barFill, 
                                { backgroundColor: colors.success, width: `${total > 0 ? (buys / total) * 100 : 50}%` }
                            ]} 
                        />
                    </View>
                </View>
                <View style={[styles.barWrapper, { flex: 1 }]}>
                    <View style={styles.barHeader}>
                        <Text style={styles.sellLabel}>Sells</Text>
                        <Text style={styles.sellValue}>{sells.toLocaleString()}</Text>
                    </View>
                    <View style={styles.barBackground}>
                        <View 
                            style={[
                                styles.barFill, 
                                { backgroundColor: colors.error, width: `${total > 0 ? (sells / total) * 100 : 50}%` }
                            ]} 
                        />
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgSemi,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        marginTop: 12,
        marginHorizontal: 16,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 16,
    },
    totalValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: colors.titleText,
    },
    totalLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    barsContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    barWrapper: {
        gap: 8,
    },
    barHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    buyLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.success,
    },
    buyValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.success,
    },
    sellLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.error,
    },
    sellValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.error,
    },
    barBackground: {
        height: 8,
        backgroundColor: colors.bgCards,
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
    },
});
