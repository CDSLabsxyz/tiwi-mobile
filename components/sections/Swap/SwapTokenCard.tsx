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
    onInputPress?: () => void;
    isLoadingQuote?: boolean;
    isRefreshing?: boolean;
    /** Staged routing copy shown beside the skeleton while quoting. */
    quoteStep?: string;
    isStale?: boolean;
    /**
     * "To" card only: opens the recipient picker. When set, the "To" label
     * becomes a dropdown so the destination address is chosen right where the
     * destination is chosen, instead of in a separate row below the card.
     */
    onRecipientPress?: () => void;
    /**
     * Truncated destination address, shown next to the label. This is the
     * EFFECTIVE recipient — a custom one if set, otherwise your own address on
     * the destination chain — so the label always says where the output lands.
     */
    recipientLabel?: string | null;
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
    onInputPress,
    isLoadingQuote = false,
    isRefreshing = false,
    quoteStep,
    isStale = false,
    onRecipientPress,
    recipientLabel,
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
                {onRecipientPress ? (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onRecipientPress}
                        style={styles.labelDropdown}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.label}>{label}</Text>
                        {!!recipientLabel && (
                            <View style={styles.recipientPill}>
                                <Image source={WalletIcon} style={styles.recipientPillIcon} contentFit="contain" />
                                <Text style={styles.recipientPillText} numberOfLines={1}>{recipientLabel}</Text>
                            </View>
                        )}
                        <Image source={ArrowDown01} style={styles.labelChevron} contentFit="contain" />
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.label}>{label}</Text>
                )}

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
                        // Web shows the routing stage next to the skeleton in
                        // the amount slot; same here so a multi-second quote
                        // reads as "working", not "stuck".
                        <View style={styles.skeletonRow}>
                            {!!quoteStep && (
                                <Text style={styles.quoteStepText} numberOfLines={1}>
                                    {quoteStep}
                                </Text>
                            )}
                            <View style={styles.skeletonAmount} />
                        </View>
                    ) : isFrom ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={onInputPress}
                            style={styles.amountInputButton}
                        >
                            <Text
                                style={[
                                    styles.amountInput,
                                    isRefreshing && { opacity: 0.6 },
                                    !amount && { color: colors.mutedText }
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {amount || '0.0'}
                            </Text>
                        </TouchableOpacity>
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
    labelDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 1,
    },
    labelChevron: {
        width: 14,
        height: 14,
        tintColor: colors.primaryCTA,
    },
    recipientPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 2,
        maxWidth: 132,
        backgroundColor: 'rgba(177,241,40,0.14)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    recipientPillIcon: {
        width: 11,
        height: 11,
        tintColor: colors.primaryCTA,
    },
    recipientPillText: {
        flexShrink: 1,
        color: colors.primaryCTA,
        fontSize: 10,
        fontWeight: '700',
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
    amountInputButton: {
        width: '100%',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    amountInput: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: colors.titleText,
        textAlign: 'right',
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
    skeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
    },
    quoteStepText: {
        color: colors.primaryCTA,
        fontSize: 10,
        fontWeight: '500',
        flexShrink: 1,
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
