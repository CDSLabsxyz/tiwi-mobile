import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';

const TiwiLogo = require('@/assets/logo/full logo.svg');
const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
    isReady: boolean;
    onAnimationComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ isReady, onAnimationComplete }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const [animationFinished, setAnimationFinished] = useState(false);

    useEffect(() => {
        // Entrance Animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 1000,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    useEffect(() => {
        if (isReady && !animationFinished) {
            // Exit Animation: Zoom in and fade out
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 2.5, // Zoom into the screen
                    duration: 700,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                })
            ]).start(() => {
                setAnimationFinished(true);
                onAnimationComplete();
            });
        }
    }, [isReady]);

    if (animationFinished) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim }
            ]}
        >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Image
                    source={TiwiLogo}
                    style={styles.logo}
                    contentFit="contain"
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
        zIndex: 99999,
    },
    logo: {
        width: width * 0.5, // 50% of screen width (much larger)
        height: width * 0.5,
    },
});
