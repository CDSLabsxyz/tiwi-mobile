import { Image } from 'expo-image';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

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
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000000',
            }}>
                <Image
                    source={variant === 'intro' ? INTRO_GIF : LOADER_GIF}
                    style={{ width: size, height: size }}
                    contentFit="cover"
                    autoplay={true}
                    cachePolicy="memory-disk"
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
