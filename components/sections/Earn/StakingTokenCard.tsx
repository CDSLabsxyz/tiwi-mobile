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
    // New props to match web design
    tvl?: string;
    activeStakers?: string;
    isLoading?: boolean;
}

/**
 * Staking Token Card - Token display with APY, TVL, and Stakers
 */
export const StakingTokenCard: React.FC<StakingTokenCardProps> = ({
    tokenSymbol,
    tokenName,
    apy,
    tokenIcon,
    onPress,
    tvl = "0",
    activeStakers = "0",
    isLoading = false
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Top Row: Icon, Symbol, APY */}
            <View style={styles.topRow}>
                <View style={styles.tokenInfo}>
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
                    <Text style={styles.symbolText} numberOfLines={1}>
                        {tokenSymbol}
                    </Text>
                </View>

                <View style={styles.apyContainer}>
                    <Text style={styles.apyText}>
                        {apy}
                    </Text>
                    <View style={styles.arrowIconContainer}>
                        <Image
                            source={ArrowDownIcon}
                            style={styles.fullImage}
                            contentFit="contain"
                        />
                    </View>
                </View>
            </View>

            {/* Bottom Row: TVL, Stakers */}
            <View style={styles.bottomRow}>
                <Text style={styles.statsText}>
                    TVL {tvl}
                </Text>
                <Text style={styles.statsText}>
                    {activeStakers} ACTIVE STAKERS
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        width: '100%',
        gap: 8,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        maxWidth: '60%',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
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
    symbolText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
        flexShrink: 1,
    },
    apyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    apyText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.titleText,
    },
    arrowIconContainer: {
        width: 20,
        height: 20,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: 4,
    },
    statsText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 11,
        color: colors.primaryCTA,
        textTransform: 'uppercase',
        letterSpacing: -0.2,
    },
});
