/**
 * Asset List Item Component
 * Displays individual asset with icon, name, chart, balance, and USD value
 * Converted from Tailwind to StyleSheet
 */

import { Sparkline } from '@/components/ui/Sparkline';
import { TokenPrice } from '@/components/ui/TokenPrice';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import type { PortfolioItem } from '@/services/walletService';
import { formatTokenQuantity, getColorFromSeed } from '@/utils/formatting';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AssetListItemProps {
    asset: PortfolioItem & { priceUSD?: string; change24h: number; balanceFormatted: string };
    onPress?: () => void;
}

/**
 * Helper to generate mock sparkline data based on 24h change
 */
const generateSparklineData = (change: number) => {
    const points = 20;
    const data = [];
    let current = 100;
    for (let i = 0; i < points; i++) {
        // Add random noise but trend toward the final change
        const trend = (change / points) * i;
        const noise = (Math.random() - 0.5) * 2;
        data.push(current + trend + noise);
    }
    return data;
};

/**
 * Asset List Item - Individual asset row in the portfolio list
 */
export const AssetListItem: React.FC<AssetListItemProps> = ({
    asset,
    onPress,
}) => {
    const { t } = useTranslation();
    const isPositive = asset.change24h >= 0;
    // Figma Colors: success #3FEA9B, primaryCTA #B1F128, negative #FB406E
    const chartColor = isPositive ? '#B1F128' : '#FB406E';

    const sparkData = useMemo(() => generateSparklineData(asset.change24h), [asset.change24h]);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Left: Icon + Symbol/Name */}
            <View style={styles.leftSection}>
                {/* Asset Icon */}
                <View style={styles.iconContainer}>
                    {asset.logo ? (
                        <Image
                            source={asset.logo}
                            style={styles.iconImage}
                            contentFit="cover"
                        />
                    ) : (
                        <View style={[styles.iconImage, styles.fallbackCircle, { backgroundColor: getColorFromSeed(asset.symbol) }]}>
                            <Text style={styles.fallbackText}>{asset.symbol.charAt(0).toUpperCase()}</Text>
                        </View>
                    )}
                </View>

                {/* Symbol + Name */}
                <View style={styles.nameContainer}>
                    {/* Symbol */}
                    <Text style={styles.symbol}>
                        {asset.symbol}
                    </Text>

                    {/* Name */}
                    <Text style={styles.name} numberOfLines={1}>
                        {asset.name}
                    </Text>
                </View>
            </View>

            {/* Center: Sparkline Price Chart */}
            <View style={styles.chartContainer}>
                <Sparkline
                    data={sparkData}
                    color={chartColor}
                    width={70}
                    height={32}
                    strokeWidth={1.5}
                />
            </View>

            {/* Right: Balance + USD Value */}
            <View style={styles.rightSection}>
                {/* Balance Amount */}
                <Text
                    style={styles.balance}
                    numberOfLines={1}
                >
                    {formatTokenQuantity(asset.balanceFormatted.replace(/,/g, ''))} {asset.symbol}
                </Text>

                {/* USD Value */}
                <TokenPrice
                    amount={asset.usdValue}
                    style={styles.usdValue}
                />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: 142,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
    },
    iconImage: {
        width: '100%',
        height: '100%',
    },
    fallbackCircle: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    fallbackText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    nameContainer: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 2,
    },
    symbol: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: colors.titleText,
    },
    name: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        lineHeight: 20,
        color: '#8A929A',
    },
    chartContainer: {
        width: 70,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 0,
    },
    chartImage: {
        width: '100%',
        height: '100%',
    },
    chartPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.bgStroke,
        borderRadius: 4,
    },
    rightSection: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 2,
        minWidth: 120,
        maxWidth: 120,
    },
    balance: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: colors.titleText,
        textAlign: 'right',
    },
    usdValue: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        lineHeight: 20,
        color: '#8A929A',
        textAlign: 'right',
    },
});
