/**
 * Coming Soon Component
 * Displays coming soon message with rotated icon
 * Matches Figma design exactly
 */

import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const ComingSoonIcon = require('../../../assets/earn/coming-soon-02.svg');

interface ComingSoonProps {
    message?: string;
}

/**
 * Coming Soon - Centered message with icon
 */
export const ComingSoon: React.FC<ComingSoonProps> = ({
    message = "We're currently developing this feature and will make it available soon",
}) => {
    return (
        <View style={styles.container}>
            {/* Rotated Icon */}
            <View style={styles.iconWrapper}>
                <View style={styles.iconContainer}>
                    <Image
                        source={ComingSoonIcon}
                        style={styles.fullImage}
                        contentFit="contain"
                    />
                </View>
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
                <Text style={styles.title}>
                    Coming Soon
                </Text>
                <Text style={styles.message}>
                    {message}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 44,
        marginTop: 40,
    },
    iconWrapper: {
        width: 255,
        height: 255,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        width: 192,
        height: 192,
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        alignItems: 'center',
        gap: 8,
        maxWidth: 306,
    },
    title: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
        textAlign: 'center',
    },
    message: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
    },
});
