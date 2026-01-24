import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ChainId } from './ChainSelectSheet';
import { SelectionBottomSheet } from './SelectionBottomSheet';

const TWCIcon = require('@/assets/home/tiwicat-token.svg');
const USDCIcon = require('@/assets/home/coins-02.svg');
const TetherIcon = require('@/assets/home/coins-02-1.svg');
const BNBIcon = require('@/assets/home/coins-01.svg');
const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

export interface TokenOption {
    id: string;
    symbol: string;
    name: string;
    icon: any;
    tvl: string;
    balanceFiat: string;
    balanceToken: string;
}

const TOKEN_OPTIONS: TokenOption[] = [
    {
        id: 'twc',
        symbol: 'TWC',
        name: 'TWC',
        icon: TWCIcon,
        tvl: '$1,000,000',
        balanceFiat: '$0',
        balanceToken: '0 TIWI',
    },
    {
        id: 'usdc',
        symbol: 'USDC',
        name: 'USDC',
        icon: USDCIcon,
        tvl: '$1,000,000',
        balanceFiat: '$0',
        balanceToken: '0 USC',
    },
    {
        id: 'tether',
        symbol: 'Tether',
        name: 'Tether',
        icon: TetherIcon,
        tvl: '$1,000,000',
        balanceFiat: '$0',
        balanceToken: '0 TET',
    },
    {
        id: 'bnb',
        symbol: 'BNB',
        name: 'BNB',
        icon: BNBIcon,
        tvl: '$1,000,000',
        balanceFiat: '$0',
        balanceToken: '0 BSC',
    },
];

interface TokenSelectSheetProps {
    visible: boolean;
    chainId: ChainId | null;
    selectedTokenId?: string | null;
    onClose: () => void;
    onSelect: (token: TokenOption) => void;
}

/**
 * Token selection bottom sheet
 * Matches Figma token dropdown
 */
export const TokenSelectSheet: React.FC<TokenSelectSheetProps> = ({
    visible,
    chainId,
    selectedTokenId,
    onClose,
    onSelect,
}) => {
    return (
        <SelectionBottomSheet
            visible={visible}
            title="Token Selection"
            onClose={onClose}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {TOKEN_OPTIONS.map((token) => {
                    const isActive = token.id === selectedTokenId;

                    return (
                        <TouchableOpacity
                            key={token.id}
                            activeOpacity={0.9}
                            onPress={() => onSelect(token)}
                            style={[
                                styles.optionItem,
                                isActive && styles.activeItem
                            ]}
                        >
                            <View style={styles.optionContent}>
                                {/* Left: icon + symbol + TVL */}
                                <View style={styles.leftInfo}>
                                    <View style={styles.iconWrapper}>
                                        <Image source={token.icon} style={styles.fullSize} contentFit="contain" />
                                    </View>
                                    <View style={styles.textColumn}>
                                        <Text style={styles.symbol}>{token.symbol}</Text>
                                        <Text style={styles.tvl}>{token.tvl}</Text>
                                    </View>
                                </View>

                                {/* Right: balances + checkmark */}
                                <View style={styles.rightInfo}>
                                    <View style={styles.balanceColumn}>
                                        <Text style={styles.fiatBalance}>{token.balanceFiat}</Text>
                                        <Text style={styles.tokenBalance}>{token.balanceToken}</Text>
                                    </View>

                                    {isActive && (
                                        <View style={styles.checkWrapper}>
                                            <Image source={CheckmarkIcon} style={styles.fullSize} contentFit="contain" />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 8,
        paddingBottom: 24,
        gap: 16,
    },
    optionItem: {
        height: 76,
        borderRadius: 16,
        backgroundColor: colors.bgSemi,
        overflow: 'hidden',
    },
    activeItem: {
        backgroundColor: colors.bgShade20,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: '100%',
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconWrapper: {
        width: 40,
        height: 40,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    textColumn: {
        gap: 4,
    },
    symbol: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
    },
    tvl: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    rightInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    balanceColumn: {
        alignItems: 'flex-end',
        gap: 4,
    },
    fiatBalance: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    tokenBalance: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    checkWrapper: {
        width: 24,
        height: 24,
    },
});
