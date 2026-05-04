import { colors } from '@/constants/colors';
import { MarketAsset } from '@/lib/mobile/api-client';
import { formatNumber, formatPercentageChange } from '@/utils/formatting';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TokenPrice } from '@/components/ui/TokenPrice';
import { useTranslation } from '@/hooks/useLocalization';

const TWC_ADDRESS_LOWER = '0xda1060158f7d593667cce0a15db346bb3ffb3596';

interface TokenListItemProps {
    token: MarketAsset & { displaySymbol?: string; priceUSD?: string; marketCapRank?: number };
    onPress: () => void;
}

export const TokenListItem = React.memo(({ token, onPress }: TokenListItemProps) => {
    const { t } = useTranslation();
    const change = formatPercentageChange(token.priceChange24h || 0);
    const priceChangeColor = change.isPositive ? colors.success : colors.error;
    const isTwc =
        token.symbol?.toUpperCase() === 'TWC' ||
        token.address?.toLowerCase() === TWC_ADDRESS_LOWER;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.tokenItem}
        >
            {/* Left Side - Token Info */}
            <View style={styles.tokenInfoLeft}>
                <Image
                    source={token.logoURI}
                    style={styles.tokenLogo}
                    contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                    {/* Token Pair */}
                    <View style={styles.tokenPairRow}>
                        <Text
                            style={styles.tokenSymbol}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {token.displaySymbol || token.symbol}
                        </Text>
                        {isTwc && (
                            <View style={styles.announceBadge}>
                                <Ionicons
                                    name="megaphone"
                                    size={11}
                                    color={colors.primaryCTA}
                                />
                            </View>
                        )}
                    </View>
                    {/* Volume */}
                    <Text style={styles.tokenVolume} numberOfLines={1}>
                        {t('home.vol')} {formatNumber(token.volume24h || 0)}
                    </Text>
                </View>
            </View>

            {/* Right Side - Price and Change */}
            <View style={styles.tokenInfoRight}>
                <TokenPrice amount={token.priceUSD} style={styles.tokenPrice} />
                <Text style={[styles.tokenChange, { color: priceChangeColor }]}>
                    {change.formatted}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    tokenItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 0,
    },
    tokenInfoLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    tokenPairRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    tokenSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        color: colors.titleText,
        flexShrink: 1,
    },
    tokenQuote: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: colors.bodyText,
    },
    leverageBadge: {
        backgroundColor: colors.bgStroke,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    announceBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(177, 241, 40, 0.12)',
    },
    leverageText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        lineHeight: 14,
        color: colors.bodyText,
    },
    tokenVolume: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        lineHeight: 16,
        color: colors.bodyText,
    },
    tokenLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    tokenInfoRight: {
        alignItems: 'flex-end',
    },
    tokenPrice: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        color: colors.titleText,
        marginBottom: 4,
    },
    tokenChange: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        lineHeight: 16,
    },
});
