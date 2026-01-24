import { colors } from '@/constants/colors';
import { MarketToken } from '@/types/market';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TokenListItemProps {
    token: MarketToken;
    onPress: () => void;
}

export const TokenListItem: React.FC<TokenListItemProps> = ({ token, onPress }) => {
    const isPositive = token.priceChange >= 0;
    const priceChangeColor = isPositive ? colors.success : colors.error;

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.tokenItem}
        >
            {/* Left Side - Token Info */}
            <View style={styles.tokenInfoLeft}>
                <View style={{ flex: 1 }}>
                    {/* Token Pair */}
                    <View style={styles.tokenPairRow}>
                        <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                        <Text style={styles.tokenQuote}>/USDT</Text>
                        {/* Leverage Badge */}
                        <View style={styles.leverageBadge}>
                            <Text style={styles.leverageText}>{token.leverage}X</Text>
                        </View>
                    </View>
                    {/* Volume */}
                    <Text style={styles.tokenVolume}>Vol {token.volume}</Text>
                </View>
            </View>

            {/* Right Side - Price and Change */}
            <View style={styles.tokenInfoRight}>
                <Text style={styles.tokenPrice}>{token.price}</Text>
                <Text style={[styles.tokenChange, { color: priceChangeColor }]}>
                    {token.priceChangePercent}
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
