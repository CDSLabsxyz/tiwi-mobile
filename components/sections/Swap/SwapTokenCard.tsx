import { colors } from '@/constants/colors';
import { getColorFromSeed } from '@/utils/formatting';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const WalletIcon = require('@/assets/home/wallet-03.svg');
const ArrowDown01 = require('@/assets/home/arrow-down-01.svg');
const ArrowDownWhite = require('@/assets/home/arrow-down-01.svg'); // Fallback
const TiwicatToken = require('@/assets/home/tiwicat-token.svg');
const ChainBadge = require('@/assets/home/chains/ethereum.svg');

export type SwapTokenVariant = 'from' | 'to';

interface SwapTokenCardProps {
    variant: SwapTokenVariant;
    tokenSymbol?: string;
    tokenChain?: string;
    tokenSelected: boolean;
    tokenIcon?: any;
    chainBadgeIcon?: any;
    amount: string;
    fiatAmount: string;
    balanceText: string;
    onAmountChange?: (value: string) => void;
    onTokenPress?: () => void;
    onMaxPress?: () => void;
    isLoadingQuote?: boolean;
    isRefreshing?: boolean;
    isStale?: boolean;
}

/**
 * Token amount card (From / To)
 * Aligned 1:1 with Figma design (node-id: 3279-117141)
 */
export const SwapTokenCard: React.FC<SwapTokenCardProps> = ({
    variant,
    tokenSymbol,
    tokenChain,
    tokenSelected,
    tokenIcon,
    chainBadgeIcon,
    amount,
    fiatAmount,
    balanceText,
    onAmountChange,
    onTokenPress,
    onMaxPress,
    isLoadingQuote = false,
    isRefreshing = false,
    isStale = false,
}) => {
    const isFrom = variant === 'from';
    const label = isFrom ? 'From' : 'To';

    const handleAmountChange = (value: string) => {
        let sanitized = value.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) {
            sanitized = parts[0] + '.' + parts.slice(1).join('');
        }
        if (sanitized.length > 1 && sanitized[0] === '0' && sanitized[1] !== '.') {
            sanitized = sanitized.substring(1);
        }
        if (sanitized === '.') {
            sanitized = '0.';
        }
        onAmountChange?.(sanitized);
    };

    const displayTokenSymbol = useMemo(() => tokenSymbol ?? (isFrom ? 'TWC' : ''), [tokenSymbol, isFrom]);
    const displayTokenChain = useMemo(() => tokenChain ?? (isFrom ? 'Ethereum' : ''), [tokenChain, isFrom]);
    const displayTokenIcon = useMemo(() => tokenIcon, [tokenIcon]);
    const displayChainBadge = useMemo(() => chainBadgeIcon ?? ChainBadge, [chainBadgeIcon]);

    return (
        <View style={styles.card}>
            {/* Header: Label (left) | Balance (right) */}
            <View style={styles.headerRow}>
                <Text style={styles.label}>{label}</Text>

                <View style={styles.balanceContainer}>
                    <View style={styles.balanceRow}>
                        <Image source={WalletIcon} style={styles.walletIcon} contentFit="contain" />
                        <Text style={styles.balanceText}>{balanceText}</Text>
                    </View>
                    {isFrom && (
                        <TouchableOpacity activeOpacity={0.8} onPress={onMaxPress} style={styles.maxButton}>
                            <Text style={styles.maxText}>Max</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Main Content: Token Selector (left) | Amount Input (right) */}
            <View style={styles.mainRow}>
                <View style={styles.leftSide}>
                    {tokenSelected ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onTokenPress}
                            style={styles.tokenSelectorPill}
                        >
                            <View style={styles.tokenIconWrapper}>
                                {displayTokenIcon ? (
                                    <Image source={displayTokenIcon} style={styles.tokenIcon} contentFit="cover" />
                                ) : (
                                    <View style={[styles.tokenIcon, styles.fallbackCircle, { backgroundColor: getColorFromSeed(displayTokenSymbol) }]}>
                                        <Text style={styles.fallbackText}>{displayTokenSymbol.charAt(0).toUpperCase()}</Text>
                                    </View>
                                )}
                                <View style={styles.chainBadgeWrapper}>
                                    <Image source={displayChainBadge} style={styles.chainBadge} contentFit="cover" />
                                </View>
                            </View>

                            <View style={styles.tokenTextInfo}>
                                <Text style={styles.tokenSymbolText} numberOfLines={1}>{displayTokenSymbol}</Text>
                                <Text style={styles.tokenChainText} numberOfLines={1}>{displayTokenChain}</Text>
                            </View>

                            <Image source={ArrowDown01} style={styles.dropdownIcon} contentFit="contain" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onTokenPress}
                            style={styles.selectTokenButton}
                        >
                            <Text style={styles.selectTokenText}>Select Token</Text>
                            <Image source={ArrowDown01} style={styles.dropdownIconBlack} contentFit="contain" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.rightSide}>
                    {isLoadingQuote ? (
                        <View style={styles.skeletonAmount} />
                    ) : isFrom ? (
                        <TextInput
                            value={amount}
                            onChangeText={handleAmountChange}
                            editable={true}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            placeholder="0.0"
                            placeholderTextColor={colors.mutedText}
                            style={[styles.amountInput, isRefreshing && { opacity: 0.6 }]}
                            textAlign="right"
                            multiline={false}
                            scrollEnabled={true}
                        />
                    ) : (
                        <View style={styles.toAmountContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.amountScrollContent}
                            >
                                <Text style={[styles.amountTextDisplay, (isRefreshing || isStale) && { opacity: 0.6 }]}>
                                    {amount || '0.0'}
                                </Text>
                            </ScrollView>
                        </View>
                    )}
                    <View style={styles.fiatContainer}>
                        {isLoadingQuote ? (
                            <View style={styles.skeletonFiat} />
                        ) : (
                            fiatAmount && fiatAmount !== '$0.00' && fiatAmount !== '0.00' && (
                                <Text style={[styles.fiatAmountText, (isRefreshing || isStale) && { opacity: 0.6 }]}>{fiatAmount}</Text>
                            )
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        width: '100%',
        backgroundColor: colors.bgSemi,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.titleText,
        opacity: 0.6,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    walletIcon: {
        width: 12,
        height: 12,
    },
    balanceText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.bodyText,
    },
    maxButton: {
        backgroundColor: colors.bgStroke, // Darker green background for Max pill
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 32,
    },
    maxText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.primaryCTA,
    },
    mainRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftSide: {
        flex: 1,
        alignItems: 'flex-start',
    },
    tokenSelectorPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCards,
        borderRadius: 64,
        padding: 4,
        paddingRight: 10,
        gap: 8,
    },
    tokenIconWrapper: {
        width: 32,
        height: 32,
        position: 'relative',
    },
    tokenIcon: {
        width: 32,
        height: 32,
        borderRadius: 999,
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
    chainBadgeWrapper: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        backgroundColor: colors.bgCards,
        borderRadius: 999,
        padding: 1,
        overflow: 'hidden',
    },
    chainBadge: {
        width: '100%',
        height: '100%',
        borderRadius: 999,
    },
    tokenTextInfo: {
        justifyContent: 'center',
    },
    tokenSymbolText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
    },
    tokenChainText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.bodyText,
        opacity: 0.6,
    },
    dropdownIcon: {
        width: 14,
        height: 14,
    },
    dropdownIconBlack: {
        width: 14,
        height: 14,
        tintColor: colors.titleText,
    },
    selectTokenButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.accentDark40,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6,
    },
    selectTokenText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText, // 156200
    },
    rightSide: {
        flex: 1,
        alignItems: 'flex-end',
    },
    amountInput: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: colors.titleText,
        width: '100%',
        padding: 0,
    },
    toAmountContainer: {
        width: '100%',
        alignItems: 'flex-end',
    },
    amountScrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-end',
    },
    amountTextDisplay: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: colors.titleText,
        textAlign: 'right',
    },
    fiatContainer: {
        marginTop: 2,
    },
    fiatAmountText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
        opacity: 0.6,
    },
    skeletonAmount: {
        width: 100,
        height: 30,
        borderRadius: 4,
        backgroundColor: colors.bgStroke,
    },
    skeletonFiat: {
        width: 60,
        height: 12,
        borderRadius: 2,
        backgroundColor: colors.bgStroke,
    },
});
