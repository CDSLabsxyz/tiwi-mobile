/**
 * Asset List Item Component
 * Displays individual asset with icon, name, chart, balance, and USD value
 * Converted from Tailwind to StyleSheet
 */

import { colors } from '@/constants/colors';
import type { PortfolioItem } from '@/services/walletService';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AssetListItemProps {
    asset: PortfolioItem;
    onPress?: () => void;
}

/**
 * Asset List Item - Individual asset row in the portfolio list
 */
export const AssetListItem: React.FC<AssetListItemProps> = ({
    asset,
    onPress,
}) => {
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
                    <Image
                        source={asset.icon}
                        style={styles.iconImage}
                        contentFit="cover"
                    />
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

            {/* Center: Price Chart (Placeholder) */}
            <View style={styles.chartContainer}>
                {asset.chartData ? (
                    <Image
                        source={{ uri: asset.chartData }}
                        style={styles.chartImage}
                        contentFit="contain"
                    />
                ) : (
                    <View style={styles.chartPlaceholder} />
                )}
            </View>

            {/* Right: Balance + USD Value */}
            <View style={styles.rightSection}>
                {/* Balance Amount */}
                <Text
                    style={styles.balance}
                    numberOfLines={1}
                    adjustsFontSizeToFit={false}
                >
                    {(() => {
                        // Parse the balance number and round it to fit within the width
                        const balanceNum = parseFloat(asset.balance.replace(/,/g, ''));
                        if (isNaN(balanceNum)) return asset.balance;

                        // Try different decimal places until it fits
                        let decimals = 8;
                        let formatted = balanceNum.toFixed(decimals);

                        // Remove trailing zeros
                        formatted = formatted.replace(/\.?0+$/, '');

                        // If still too long, reduce decimals progressively
                        while (formatted.length > 12 && decimals > 0) {
                            decimals--;
                            formatted = balanceNum.toFixed(decimals).replace(/\.?0+$/, '');
                        }

                        // Add thousand separators if needed
                        const parts = formatted.split('.');
                        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        return parts.length > 1 ? parts.join('.') : parts[0];
                    })()}
                </Text>

                {/* USD Value */}
                <Text style={styles.usdValue}>
                    {asset.usdValue}
                </Text>
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
