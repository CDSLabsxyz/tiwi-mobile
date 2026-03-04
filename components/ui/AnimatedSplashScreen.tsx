import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';

const IntroGif = require('../../assets/GIF/intro_animation.gif');
const { width, height } = Dimensions.get('window');

// Optimized duration for much faster startup
const GIF_DURATION = 1800;

interface AnimatedSplashScreenProps {
    isReady: boolean;
    onAnimationComplete: () => void;
    onLoaded?: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ isReady, onAnimationComplete, onLoaded }) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [animationFinished, setAnimationFinished] = useState(false);
    const [gifDurationPassed, setGifDurationPassed] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
        if (hasLoaded) {
            // Wait for the full GIF duration (1.8s) after it has actually loaded
            const maxTimer = setTimeout(() => {
                setGifDurationPassed(true);
            }, GIF_DURATION);

            return () => {
                clearTimeout(maxTimer);
            };
        }
    }, [hasLoaded]);

    useEffect(() => {
        // We only exit when BOTH the GIF has played (1.8s) AND the app is ready.
        if (isReady && gifDurationPassed) {
            // Exit Animation: Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 600, // Slightly smoother fade
                useNativeDriver: true,
            }).start(() => {
                setAnimationFinished(true);
                onAnimationComplete();
            });
        }
    }, [isReady, gifDurationPassed]);

    if (animationFinished) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim }
            ]}
        >
            <Image
                source={IntroGif}
                style={styles.logo}
                contentFit="contain"
                autoplay={true}
                cachePolicy="memory-disk"
                onLoad={() => {
                    setHasLoaded(true);
                    // Notify parent that the GIF is loaded and ready to be seen
                    if (onLoaded) onLoaded();
                }}
                onError={(e) => {
                    console.error("SplashScreen GIF Error:", e);
                    setHasLoaded(true); // Allow exit on error
                    if (onLoaded) onLoaded();
                }}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
    },
    logo: {
        width: width,
        height: height,
    },
});
