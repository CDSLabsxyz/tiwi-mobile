import { colors } from '@/constants/colors';
import { TokenMetadata } from '@/services/apiClient';
import { formatCurrencyWithSuffix, formatNumber, formatPercentageChange, formatUSDPrice } from '@/utils/formatting';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const imgChartLine = "http://localhost:3845/assets/e32e087f99ed074a5dc70df41413111fad0edd30.svg";
const imgChartCandle = "http://localhost:3845/assets/032b4d324a66506f1d09ab9ae61af60627c4f0af.svg";

interface PriceHeaderProps {
    token: TokenMetadata;
    quoteSymbol?: string;
}

export const PriceHeader: React.FC<PriceHeaderProps> = ({
    token,
    quoteSymbol = 'USDT'
}) => {
    const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
    const isPositive = (token.priceChange24h || 0) >= 0;
    const { formatted: changeText } = formatPercentageChange(token.priceChange24h || 0);

    return (
        <View style={styles.container}>
            {/* Symbol and Toggles Row */}
            <View style={styles.pairRow}>
                <View style={styles.tokenInfo}>
                    <Image
                        source={token.logoURI}
                        style={styles.logo}
                        contentFit="cover"
                    />
                    <Text style={styles.symbol}>
                        {token.symbol}
                        <Text style={styles.quote}>/{quoteSymbol}</Text>
                    </Text>
                </View>

                <View style={styles.chartToggle}>
                    <TouchableOpacity
                        onPress={() => setChartMode('line')}
                        style={[styles.toggleBtn, chartMode === 'line' && styles.toggleActive]}
                    >
                        <Image
                            source={require('@/assets/market/chart-line-data-02.svg')}
                            style={[styles.toggleIcon, chartMode === 'line' && styles.toggleIconActive]}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setChartMode('candle')}
                        style={[styles.toggleBtn, chartMode === 'candle' && styles.toggleActive]}
                    >
                        <Image
                            source={require('@/assets/market/chart-01.svg')}
                            style={[styles.toggleIcon, chartMode === 'candle' && styles.toggleIconActive]}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Price and Stats Row */}
            <View style={styles.detailsRow}>
                {/* Left: Price and Change */}
                <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>
                        {formatUSDPrice(token.priceUSD || '0')}
                    </Text>
                    <View style={styles.changeRow}>
                        <Text style={[
                            styles.changeText,
                            { color: isPositive ? colors.success : colors.error }
                        ]}>
                            {changeText}
                        </Text>
                        <Text style={styles.timeframeText}>1D</Text>
                    </View>
                </View>

                {/* Right: Market Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>M.cap</Text>
                        <Text style={styles.statValue}>{formatCurrencyWithSuffix(token.marketCap || 0)}</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>24H High</Text>
                        <Text style={styles.statValue}>{formatNumber(token.high24h || 0)}</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>24H Low</Text>
                        <Text style={styles.statValue}>{formatNumber(token.low24h || 0)}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: colors.bg,
    },
    pairRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logo: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.bgCards,
    },
    symbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    quote: {
        color: colors.bodyText,
    },
    chartToggle: {
        flexDirection: 'row',
        backgroundColor: colors.bgSemi,
        borderRadius: 100,
        padding: 2,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    toggleBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toggleActive: {
        backgroundColor: colors.bgStroke,
    },
    toggleIcon: {
        width: 14,
        height: 14,
        tintColor: colors.bodyText,
    },
    toggleIconActive: {
        tintColor: colors.titleText,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    priceContainer: {
        flex: 1,
    },
    priceLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 28,
        color: colors.titleText,
        lineHeight: 34,
    },
    changeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    changeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
    },
    timeframeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    statsContainer: {
        alignItems: 'flex-end',
        gap: 4,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.bodyText,
        minWidth: 50,
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
        minWidth: 60,
        textAlign: 'right',
    },
});
