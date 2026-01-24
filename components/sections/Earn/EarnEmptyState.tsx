/**
 * Earn Empty State Component
 * Displays a themed empty state for Earn tabs (No Pools found)
 * Matches Figma design exactly
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface EarnEmptyStateProps {
    title?: string;
    description: string;
}

// Token Ring Image
const CoinImage = require('../../../assets/earn/Coin.svg');

/**
 * EarnEmptyState - Card with icon and message
 */
export const EarnEmptyState: React.FC<EarnEmptyStateProps> = ({
    title = "No Pools found",
    description
}) => {
    return (
        <View style={styles.container}>
            {/* Coin SVG Image */}
            <View style={styles.iconWrapper}>
                <Image
                    source={CoinImage}
                    style={styles.coinImage}
                    contentFit="contain"
                />
            </View>

            <View style={styles.textContainer}>
                <Text style={styles.titleText}>
                    {title}
                </Text>
                <Text style={styles.descriptionText}>
                    {description}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 267,
        backgroundColor: 'rgba(11, 15, 10, 0.4)',
        borderRadius: 24,
        alignItems: 'center',
        paddingTop: 32,
    },
    iconWrapper: {
        width: 228,
        height: 128,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coinImage: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        marginTop: 10,
        alignItems: 'center',
    },
    titleText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.bodyText,
        textAlign: 'center',
        marginBottom: 8,
    },
    descriptionText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 10,
        color: colors.mutedText,
        textAlign: 'center',
    }
});
