import { colors } from '@/constants/colors';
import { TokenMetadata } from '@/services/apiClient';
import { formatUSDPrice } from '@/utils/formatting';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TokenMetricsProps {
    token: TokenMetadata;
}

export const TokenMetrics: React.FC<TokenMetricsProps> = ({ token }) => {
    const stats = [
        { label: 'Market Cap', value: formatUSDPrice(token.marketCap || 0) },
        { label: 'Liquidity', value: formatUSDPrice(token.liquidity || 0) },
        { label: '24h Volume', value: formatUSDPrice(token.volume24h || 0) },
    ];

    return (
        <View style={styles.container}>
            {stats.map((stat, index) => (
                <View key={index} style={styles.row}>
                    <Text style={styles.label}>{stat.label}</Text>
                    <Text style={styles.value}>{stat.value}</Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    value: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
});
