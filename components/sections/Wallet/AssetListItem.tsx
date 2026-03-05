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
import { useWalletStore } from '@/store/walletStore';
import { formatTokenQuantity, getColorFromSeed } from '@/utils/formatting';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AssetListItemProps {
    asset: PortfolioItem & {
        priceUSD?: string;
        change24h: number;
        balanceFormatted: string;
        chainLogo?: string;
        chainName?: string; // Add chainName from parent
    };
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
    const isBalanceHidden = useWalletStore((state) => state.isBalanceHidden);
    const { t } = useTranslation();
    const isPositive = asset.change24h >= 0;
    // Figma Colors: success #3FEA9B, primaryCTA #B1F128, negative #FB406E
    const chartColor = isPositive ? '#B1F128' : '#FB406E';

    const sparkData = useMemo(() => generateSparklineData(asset.change24h), [asset.change24h]);

    // Get chain badge, if the token is on a non-Ethereum mainnet chain (unless Ethereum logo itself is wanted)
    const chainBadge = asset.chainId !== 1 ? asset.chainLogo : null;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Left: Icon + Symbol/Subtitle */}
            <View style={styles.leftSection}>
                {/* Asset Icon Wrapper */}
                <View style={styles.iconWrapper}>
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

                    {/* Chain Badge (Floating) */}
                    {chainBadge && (
                        <View style={styles.badgeContainer}>
                            <Image
                                source={chainBadge}
                                style={styles.badgeImage}
                                contentFit="contain"
                            />
                        </View>
                    )}
                </View>

                {/* Symbol + Chain Name Subtitle */}
                <View style={styles.nameContainer}>
                    {/* Symbol */}
                    <Text style={styles.symbol}>
                        {asset.symbol}
                    </Text>

                    {/* Network Name (e.g., BNB Chain) instead of token name */}
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {asset.chainName || asset.name}
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
                    {isBalanceHidden ? '****' : `${formatTokenQuantity(asset.balanceFormatted.replace(/,/g, ''))} ${asset.symbol}`}
                </Text>

                {/* USD Value */}
                {isBalanceHidden ? (
                    <Text style={styles.usdValue}>****</Text>
                ) : (
                    <TokenPrice
                        amount={asset.usdValue}
                        style={styles.usdValue}
                    />
                )}
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
        gap: 12,
        flex: 1,
    },
    iconWrapper: {
        position: 'relative',
        width: 38,
        height: 38,
        justifyContent: 'center',
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF', // Image 1 shows a white background circle for most logos
    },
    iconImage: {
        width: '100%',
        height: '100%',
    },
    badgeContainer: {
        position: 'absolute',
        bottom: -4,
        right: -2,
        backgroundColor: '#000000', // Image 1 shows a black background for the badge
        borderRadius: 10,
        width: 18,
        height: 18,
        padding: 2,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#1D2125', // Use a dark border for contrast
        elevation: 3, // For Android
        shadowColor: '#000000', // For iOS
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    badgeImage: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
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
        gap: 0,
    },
    symbol: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        lineHeight: 22,
        color: colors.titleText,
    },
    subtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        lineHeight: 18,
        color: '#8A929A', // Corresponds to the gray subtitle in Image 1
    },
    chartContainer: {
        width: 70,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
    },
    rightSection: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 0,
        minWidth: 100,
    },
    balance: {
        fontFamily: 'Manrope-Medium',
        fontSize: 15,
        lineHeight: 22,
        color: colors.titleText,
        textAlign: 'right',
    },
    usdValue: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        lineHeight: 18,
        color: '#8A929A',
        textAlign: 'right',
    },
});
