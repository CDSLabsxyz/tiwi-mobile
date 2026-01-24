/**
 * My Stake Card Component
 * Represents a single staking position in the "My Stakes" list
 * Matches Figma design (node-id: 1606:4541)
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/constants/colors';

interface MyStakeCardProps {
    symbol: string;
    apy: string;
    icon: any;
    onPress: () => void;
}

const ArrowIcon = require('../../../assets/home/arrow-down-01.svg'); // Using arrow-down as per design, though navigation usually implies right

export const MyStakeCard: React.FC<MyStakeCardProps> = ({
    symbol,
    apy,
    icon,
    onPress
}) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Left: Token Info */}
            <View style={styles.leftContent}>
                <Image
                    source={icon}
                    style={styles.tokenIcon}
                    contentFit="cover"
                />
                <Text style={styles.symbolText}>{symbol}</Text>
            </View>

            {/* Center: APY */}
            <View style={styles.centerContent}>
                <Text style={styles.apyText}>{apy}</Text>
            </View>

            {/* Right: Action Icon */}
            <View style={styles.rightContent}>
                <Image
                    source={ArrowIcon}
                    style={styles.actionIcon}
                    contentFit="contain"
                    // Rotate to point right if it's a navigation item, 
                    // looking at the design `arrow-down-01` suggests maybe it's an accordion?
                    // But context implies navigation. I'll transform it for now to -90deg to point right?
                    // Or keep it as is if it's strictly matching Figma.
                    // Let's keep it as is, but usually list items have chevron right.
                    // The figma shows "arrow-down-01".
                />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 72,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1, // Take up space
    },
    tokenIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    symbolText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    apyText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.titleText,
    },
    rightContent: {
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    actionIcon: {
        width: 24,
        height: 24,
        tintColor: colors.mutedText, // Assuming it might need tinting, or keep original
    },
});
