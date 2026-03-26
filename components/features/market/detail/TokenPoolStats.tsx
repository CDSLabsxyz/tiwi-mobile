import { colors } from '@/constants/colors';
import { formatCompactNumber } from '@/utils/formatting';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TokenPoolStatsProps {
    liquidity: number;
    volume24h: number;
    marketCap: number;
    fdv: number;
    holders?: number;
    score?: number;
}

export const TokenPoolStats: React.FC<TokenPoolStatsProps> = ({
    liquidity,
    volume24h,
    marketCap,
    fdv,
    holders,
    score
}) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Pool Stats</Text>
            <View style={styles.row}>
                <Text style={styles.label}>Liquidity</Text>
                <Text style={[styles.value, { color: colors.primaryCTA }]}>{formatCompactNumber(liquidity)}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>24h Volume</Text>
                <Text style={styles.value}>{formatCompactNumber(volume24h)}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Market Cap</Text>
                <Text style={styles.value}>{formatCompactNumber(marketCap)}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>FDV</Text>
                <Text style={styles.value}>{formatCompactNumber(fdv)}</Text>
            </View>
            {holders !== undefined && (
                <View style={styles.row}>
                    <Text style={styles.label}>Holders</Text>
                    <Text style={styles.value}>{holders.toLocaleString()}</Text>
                </View>
            )}
            {score !== undefined && (
                <View style={[styles.row, { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.bgStroke }]}>
                    <Text style={styles.label}>Security Score</Text>
                    <Text style={[styles.value, { color: score > 70 ? colors.success : colors.warning }]}>{score}/100</Text>
                </View>
            )}
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
        gap: 12,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
        marginBottom: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
    value: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
    },
});
