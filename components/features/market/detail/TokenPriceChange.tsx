import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TokenPriceChangeProps {
    priceChange5m: number;
    priceChange1h: number;
    priceChange24h: number;
}

function formatPercent(value: number): string {
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}%`;
}

export const TokenPriceChange: React.FC<TokenPriceChangeProps> = ({
    priceChange5m,
    priceChange1h,
    priceChange24h
}) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Price Change</Text>
            <View style={styles.grid}>
                <View style={styles.card}>
                    <Text style={styles.label}>5M</Text>
                    <Text style={[
                        styles.value, 
                        { color: priceChange5m >= 0 ? colors.success : colors.error }
                    ]}>
                        {formatPercent(priceChange5m)}
                    </Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.label}>1H</Text>
                    <Text style={[
                        styles.value, 
                        { color: priceChange1h >= 0 ? colors.success : colors.error }
                    ]}>
                        {formatPercent(priceChange1h)}
                    </Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.label}>24H</Text>
                    <Text style={[
                        styles.value, 
                        { color: priceChange24h >= 0 ? colors.success : colors.error }
                    ]}>
                        {formatPercent(priceChange24h)}
                    </Text>
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
    grid: {
        flexDirection: 'row',
        gap: 8,
    },
    card: {
        flex: 1,
        backgroundColor: colors.bgCards,
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
    },
    label: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        marginBottom: 4,
    },
    value: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
    },
});
