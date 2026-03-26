import { colors } from '@/constants/colors';
import { EnrichedMarket } from '@/services/apiClient';
import { formatPercentageChange, formatSmartPrice, formatSmartUSD, formatUSDPrice } from '@/utils/formatting';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const imgChartLine = "http://localhost:3845/assets/e32e087f99ed074a5dc70df41413111fad0edd30.svg";
const imgChartCandle = "http://localhost:3845/assets/032b4d324a66506f1d09ab9ae61af60627c4f0af.svg";

interface PriceHeaderProps {
    token: EnrichedMarket;
    quoteSymbol?: string;
    chainName?: string;
}

export const PriceHeader: React.FC<PriceHeaderProps> = ({
    token,
    quoteSymbol = 'USD',
    chainName = 'BNB Chain' // Default
}) => {
    const isPositive = (token.priceChange24h || 0) >= 0;
    const { formatted: changeText } = formatPercentageChange(token.priceChange24h || 0);
    const displayPrice = formatUSDPrice(token.priceUSD || '0');

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Image
                    source={token.logoURI || token.logo}
                    style={styles.logo}
                    contentFit="cover"
                />
                <View style={styles.tokenMeta}>
                    <View style={styles.symbolRow}>
                        <Text style={styles.symbol}>{token.symbol}</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{chainName}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.priceRow}>
                        <Text style={styles.price}>{displayPrice}</Text>
                        <Text style={[
                            styles.change,
                            { color: isPositive ? colors.success : colors.error }
                        ]}>
                            {changeText}
                        </Text>
                        <Text style={styles.duration}>1D</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 12,
        backgroundColor: colors.bg,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bgCards,
        marginRight: 10,
    },
    tokenMeta: {
        flex: 1,
        justifyContent: 'center',
    },
    symbolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 0,
    },
    symbol: {
        fontFamily: 'Manrope-Bold',
        fontSize: 22,
        color: colors.titleText,
        letterSpacing: -0.5,
    },
    badge: {
        backgroundColor: '#1E1E1E',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 11,
        color: '#8A8A8A',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    price: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: colors.titleText,
        letterSpacing: -0.5,
    },
    change: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    duration: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#666',
    },
});
