import { colors } from '@/constants/colors';
import { BlurView } from 'expo-blur';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

interface SwapLoadingOverlayProps {
    visible: boolean;
}

/**
 * Loading overlay for swap confirmation
 * Matches Figma loading state
 */
export const SwapLoadingOverlay: React.FC<SwapLoadingOverlayProps> = ({
    visible,
}) => {
    if (!visible) return null;

    return (
        <View style={styles.container}>
            <BlurView intensity={20} tint="dark" style={styles.blur}>
                <ActivityIndicator size="large" color={colors.primaryCTA} />
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    blur: {
        flex: 1,
        backgroundColor: 'rgba(1, 5, 1, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
