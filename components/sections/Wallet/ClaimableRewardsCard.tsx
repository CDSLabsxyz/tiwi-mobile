/**
 * Claimable Rewards Card Component
 * Displays claimable rewards amount with expandable arrow
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const StarIcon = require('@/assets/home/star-18.svg');
const ArrowDownIcon = require('@/assets/home/arrow-down-01.svg');

interface ClaimableRewardsCardProps {
    amount: string;
    onPress?: () => void;
}

/**
 * Claimable Rewards Card - Shows rewards amount with expand arrow
 */
export const ClaimableRewardsCard: React.FC<ClaimableRewardsCardProps> = ({
    amount,
    onPress,
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Background Gradient Line (Simulated with View) */}
            <View style={styles.gradientLine} />

            {/* Left: Star Icon + Text */}
            <View style={styles.leftSection}>
                <View style={styles.starIconWrapper}>
                    <Image
                        source={StarIcon}
                        style={styles.fullSize}
                        contentFit="contain"
                    />
                </View>
                <Text style={styles.labelText}>
                    Claimable Rewards:{' '}
                    <Text style={styles.amountText}>{amount}</Text>
                </Text>
            </View>

            {/* Right: Arrow Icon (rotated) */}
            <View style={styles.arrowIconWrapper}>
                <Image
                    source={ArrowDownIcon}
                    style={styles.fullSize}
                    contentFit="contain"
                />
            </View>

            {/* Decorative Glow (Simulated with View) */}
            <View style={styles.glow} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        position: 'relative',
    },
    gradientLine: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        height: 1,
        backgroundColor: colors.primaryCTA,
        opacity: 0.3,
        borderRadius: 999,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    starIconWrapper: {
        width: 18,
        height: 18,
    },
    labelText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    amountText: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.titleText,
    },
    arrowIconWrapper: {
        width: 16,
        height: 16,
        transform: [{ rotate: '270deg' }], // Pointing right/rotated
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    glow: {
        position: 'absolute',
        width: 144,
        height: 36,
        left: 91,
        top: 39,
        backgroundColor: colors.primaryCTA,
        opacity: 0.05,
        borderRadius: 72,
    },
});
