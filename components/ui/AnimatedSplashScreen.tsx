import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';

// Rasterized from assets/NEWSPLASH.svg (that 7.2 MB pure-vector SVG rendered
// wrong under expo-image - its heavy paths, incl. the green arc, got dropped).
// This 1179×2556 (3×, 393×852 @3) PNG is pixel-perfect and loads instantly.
const SplashImage = require('../../assets/newsplash.png');
const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
    isReady: boolean;
    onAnimationComplete: () => void;
    onLoaded?: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ isReady, onAnimationComplete, onLoaded }) => {
    // Drives both the container fade and the image's gentle zoom, so the splash
    // eases INTO the app instead of cutting out. 0 = splash shown, 1 = revealed.
    const progress = useRef(new Animated.Value(0)).current;
    const [animationFinished, setAnimationFinished] = useState(false);

    useEffect(() => {
        if (onLoaded) onLoaded();
    }, []);

    // Ease out once the app is ready: fade the overlay while the artwork scales
    // up slightly, revealing the main page underneath in one smooth motion.
    useEffect(() => {
        if (isReady) {
            Animated.timing(progress, {
                toValue: 1,
                duration: 650,
                easing: Easing.bezier(0.22, 1, 0.36, 1), // easeOutQuint - soft, decelerating
                useNativeDriver: true,
            }).start(() => {
                setAnimationFinished(true);
                onAnimationComplete();
            });
        }
    }, [isReady]);

    const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

    if (animationFinished) return null;

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <Animated.View style={{ transform: [{ scale }] }}>
                <Image
                    source={SplashImage}
                    style={styles.image}
                    contentFit="cover"
                />
            </Animated.View>
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
    image: {
        width,
        height,
    },
});
