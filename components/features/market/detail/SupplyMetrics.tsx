import { colors } from '@/constants/colors';
import { EnrichedMarket } from '@/services/apiClient';
import { formatNumber } from '@/utils/formatting';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SupplyMetricsProps {
    token: EnrichedMarket;
}

export const SupplyMetrics: React.FC<SupplyMetricsProps> = ({ token }) => {
    const supplies = [
        { label: 'Circulating Supply', value: formatNumber(token.circulatingSupply || 0) },
        { label: 'Total Supply', value: formatNumber(token.totalSupply || 0) },
        { label: 'Max. Supply', value: token.maxSupply ? formatNumber(token.maxSupply) : '∞' },
    ];

    return (
        <View style={styles.container}>
            {supplies.map((stat, index) => (
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
