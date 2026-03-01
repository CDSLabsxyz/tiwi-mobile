import { Image } from 'expo-image';
import React from 'react';
import { Dimensions, StyleSheet, View, ViewStyle } from 'react-native';

export type TIWILoaderVariant = 'standard' | 'intro';

interface TIWILoaderProps {
    variant?: TIWILoaderVariant;
    size?: number;
    style?: ViewStyle;
}

/**
 * Global TIWI Protocol Loader
 * Uses the custom themed GIF animation
 */
const LOADER_GIF = require('../../assets/GIF/loader_animation.gif');
const INTRO_GIF = require('../../assets/GIF/intro_animation.gif');

export const TIWILoader: React.FC<TIWILoaderProps> = ({
    variant = 'standard',
    size = 120,
    style
}) => {
    return (
        <View style={[styles.container, style]}>
            <Image
                source={variant === 'intro' ? INTRO_GIF : LOADER_GIF}
                style={{ width: size, height: size }}
                contentFit="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
