/**
 * Claimable Rewards Card Component
 * Displays claimable rewards amount with expandable arrow
 * Converted from Tailwind to StyleSheet
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const StarIcon = require('../../../assets/home/star-18.svg');
const ArrowDownIcon = require('../../../assets/home/arrow-down-01.svg');

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
            {/* Gradient bottom border effect */}
            <View style={styles.gradientBorder} />

            {/* Left: Star Icon + Text */}
            <View style={styles.leftSection}>
                <View style={styles.starIcon}>
                    <Image
                        source={StarIcon}
                        style={styles.iconFull}
                        contentFit="contain"
                    />
                </View>
                <Text style={styles.text}>
                    <Text>Claimable Rewards: </Text>
                    <Text style={styles.amountText}>
                        {amount}
                    </Text>
                </Text>
            </View>

            {/* Right: Arrow Icon (rotated) */}
            <View style={styles.arrowContainer}>
                <Image
                    source={ArrowDownIcon}
                    style={styles.iconFull}
                    contentFit="contain"
                />
            </View>

            {/* Glow effect */}
            <View style={styles.glowEffect} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
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
    },
    gradientBorder: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 0,
        height: 0.5,
        borderRadius: 100,
        backgroundColor: 'rgba(177, 241, 40, 0.95)',
        opacity: 0.5,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    starIcon: {
        width: 18,
        height: 18,
    },
    text: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        textAlign: 'center',
    },
    amountText: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.titleText,
    },
    arrowContainer: {
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '90deg' }, { scaleY: -1 }],
    },
    glowEffect: {
        position: 'absolute',
        width: 144,
        height: 36,
        left: 91,
        top: 39,
        backgroundColor: 'rgba(177, 241, 40, 0.2)',
        borderRadius: 100,
        opacity: 0.3,
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
});
