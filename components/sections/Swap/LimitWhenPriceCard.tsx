import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const WalletIcon = require('@/assets/home/wallet-03.svg');
const ArrowDown01 = require('@/assets/home/arrow-down-01.svg');
const TetherIcon = require('@/assets/home/coins-02-1.svg');

interface LimitWhenPriceCardProps {
    tokenSymbol?: string;
    tokenSelected: boolean;
    tokenIcon?: any;
    chainBadgeIcon?: any;
    amount: string;
    fiatAmount: string;
    balanceText: string;
    onAmountChange?: (value: string) => void;
    onTokenPress?: () => void;
}

/**
 * When Price card for Limit tab
 * Exact 1:1 match with Figma design
 */
export const LimitWhenPriceCard: React.FC<LimitWhenPriceCardProps> = ({
    tokenSymbol,
    tokenSelected,
    tokenIcon,
    chainBadgeIcon,
    amount,
    fiatAmount,
    balanceText,
    onAmountChange,
    onTokenPress,
}) => {
    // ... logic ...
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

    const displayTokenIcon = useMemo(() => tokenIcon ?? TetherIcon, [tokenIcon]);
    const displayTokenSymbol = useMemo(() => tokenSymbol ?? 'Tether', [tokenSymbol]);

    return (
        <View style={[styles.container, { width: '100%' }]}>
            <View style={styles.content}>
                {/* Left: Token selector */}
                <View style={styles.leftSection}>
                    <Text style={styles.label}>When Price</Text>

                    {tokenSelected ? (
                        <TouchableOpacity activeOpacity={0.8} onPress={onTokenPress} style={styles.tokenPill}>
                            <View style={styles.iconContainer}>
                                <Image source={displayTokenIcon} style={styles.fullSize} contentFit="cover" />
                                {chainBadgeIcon && (
                                    <View style={styles.chainBadgeWrapper}>
                                        <Image source={chainBadgeIcon} style={styles.fullSize} contentFit="contain" />
                                    </View>
                                )}
                            </View>
                            <Text style={styles.tokenSymbol}>{displayTokenSymbol}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity activeOpacity={0.8} onPress={onTokenPress} style={styles.selectButton}>
                            <Text style={styles.selectText}>Select Token</Text>
                            <Image source={ArrowDown01} style={styles.arrowSmall} contentFit="contain" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Right: Amount input */}
                <View style={styles.rightSection}>
                    <View style={styles.balanceRow}>
                        <Image source={WalletIcon} style={styles.walletIcon} contentFit="contain" />
                        <Text style={styles.balanceText}>{balanceText}</Text>
                    </View>

                    <TextInput
                        value={amount}
                        onChangeText={handleAmountChange}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder="0.0"
                        placeholderTextColor={colors.mutedText}
                        style={styles.amountInput}
                        textAlign="right"
                    />

                    <Text style={styles.fiatAmount}>{fiatAmount}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 96,
        borderRadius: 10,
        backgroundColor: colors.bgStroke,
        padding: 16,
    },
    content: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftSection: {
        gap: 8,
        width: 140,
    },
    label: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.titleText,
    },
    tokenPill: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
        borderRadius: 64,
        backgroundColor: colors.bgCards,
        gap: 8,
    },
    iconContainer: {
        width: 32,
        height: 32,
    },
    tokenSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: colors.accentDark40,
    },
    selectText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.titleText,
    },
    arrowSmall: {
        width: 15,
        height: 15,
    },
    rightSection: {
        alignItems: 'flex-end',
        width: 120,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
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
    amountInput: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        color: colors.titleText,
        width: '100%',
        padding: 0,
    },
    fiatAmount: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    fullSize: {
        width: '100%',
        height: '100%',
        borderRadius: 999,
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
});
