/**
 * Staking Token Card Component
 * Displays token with APY for staking
 * Matches Figma design exactly
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ArrowDownIcon = require('../../../assets/home/arrow-down-01.svg');

interface StakingTokenCardProps {
    tokenSymbol: string;
    tokenName: string;
    apy: string;
    tokenIcon?: any;
    onPress?: () => void;
}

/**
 * Staking Token Card - Token display with APY
 */
export const StakingTokenCard: React.FC<StakingTokenCardProps> = ({
    tokenSymbol,
    tokenName,
    apy,
    tokenIcon,
    onPress,
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Token Icon */}
            <View style={styles.iconContainer}>
                {tokenIcon ? (
                    <Image
                        source={tokenIcon}
                        style={styles.fullImage}
                        contentFit="cover"
                    />
                ) : (
                    <View style={styles.placeholderIcon} />
                )}
            </View>

            {/* Token Info */}
            <View style={styles.infoContainer}>
                <Text style={styles.symbolText}>
                    {tokenSymbol}
                </Text>
            </View>

            {/* APY */}
            <Text style={styles.apyText}>
                {apy}
            </Text>

            {/* Dropdown Arrow */}
            <View style={styles.arrowIconContainer}>
                <Image
                    source={ArrowDownIcon}
                    style={styles.fullImage}
                    contentFit="contain"
                />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgSemi,
        height: 72,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        width: '100%',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        marginRight: 8,
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    placeholderIcon: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.bgStroke,
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    symbolText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    apyText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.titleText,
        marginRight: 8,
    },
    arrowIconContainer: {
        width: 24,
        height: 24,
    },
});
