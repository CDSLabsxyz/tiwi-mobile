import { colors } from '@/constants/colors';
import { MarketTokenPair } from '@/services/apiClient';
import { formatNumber, formatPercentageChange } from '@/utils/formatting';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TokenPrice } from '@/components/ui/TokenPrice';
import { useTranslation } from '@/hooks/useLocalization';

interface TokenListItemProps {
    token: MarketTokenPair;
    onPress: () => void;
}

export const TokenListItem: React.FC<TokenListItemProps> = ({ token, onPress }) => {
    const { t } = useTranslation();
    const change = formatPercentageChange(token.priceChange24h || 0);
    const priceChangeColor = change.isPositive ? colors.success : colors.error;

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
                            {token.symbol}
                        </Text>
                        <Text style={styles.tokenQuote}>/USDT</Text>
                        {/* Rank Badge */}
                        {token.marketCapRank && (
                            <View style={styles.leverageBadge}>
                                <Text style={styles.leverageText}>#{token.marketCapRank}</Text>
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
};

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
