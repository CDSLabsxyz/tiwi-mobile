import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SelectionBottomSheet } from './SelectionBottomSheet';
import { TokenOption } from './TokenSelectSheet';

const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

interface LimitAssetSheetProps {
    visible: boolean;
    fromToken: TokenOption | null;
    toToken: TokenOption | null;
    fromChainName?: string;
    toChainName?: string;
    fromChainIcon?: any;
    toChainIcon?: any;
    selectedTarget: 'from' | 'to' | null;
    onClose: () => void;
    onSelect: (target: 'from' | 'to') => void;
}

/**
 * Simplified sheet for selecting which token in the pair to watch for price
 */
export const LimitAssetSheet: React.FC<LimitAssetSheetProps> = ({
    visible,
    fromToken,
    toToken,
    fromChainName,
    toChainName,
    fromChainIcon,
    toChainIcon,
    selectedTarget,
    onClose,
    onSelect,
}) => {
    const options = [
        {
            id: 'from' as const,
            token: fromToken,
            chainName: fromChainName || 'Unknown',
            chainIcon: fromChainIcon,
            label: 'Pay Asset',
        },
        {
            id: 'to' as const,
            token: toToken,
            chainName: toChainName || 'Unknown',
            chainIcon: toChainIcon,
            label: 'Receive Asset',
        }
    ].filter(opt => !!opt.token);

    return (
        <SelectionBottomSheet
            visible={visible}
            title="Watch Price of..."
            onClose={onClose}
        >
            <View style={styles.content}>
                {options.map((opt) => {
                    const isActive = selectedTarget === opt.id;
                    const token = opt.token!;

                    return (
                        <TouchableOpacity
                            key={opt.id}
                            activeOpacity={0.9}
                            onPress={() => onSelect(opt.id)}
                            style={[
                                styles.optionItem,
                                isActive && styles.activeItem
                            ]}
                        >
                            <View style={styles.optionContent}>
                                <View style={styles.leftInfo}>
                                    <View style={styles.iconWrapper}>
                                        <Image source={token.icon} style={styles.fullSize} contentFit="contain" />
                                        <View style={styles.chainBadgeWrapper}>
                                            <Image source={opt.chainIcon} style={styles.fullSize} contentFit="contain" />
                                        </View>
                                    </View>
                                    <View style={styles.textColumn}>
                                        <Text style={styles.symbol}>{token.symbol}</Text>
                                        <Text style={styles.chainName}>{opt.chainName}</Text>
                                    </View>
                                </View>

                                <View style={styles.rightInfo}>
                                    <Text style={styles.labelTag}>{opt.label}</Text>
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
            </View>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: 8,
        paddingBottom: 24,
        paddingHorizontal: 16,
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
        gap: 12,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        position: 'relative',
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
    textColumn: {
        gap: 4,
    },
    symbol: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
    },
    chainName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
        opacity: 0.6,
    },
    rightInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    labelTag: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.primaryCTA,
        backgroundColor: colors.bgStroke,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    checkWrapper: {
        width: 24,
        height: 24,
    },
});
