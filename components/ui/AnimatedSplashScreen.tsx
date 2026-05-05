import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

const SplashAnimation = require('../../assets/lottie/Animation - 1774567551825.json');
const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
    isReady: boolean;
    onAnimationComplete: () => void;
    onLoaded?: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ isReady, onAnimationComplete, onLoaded }) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [animationFinished, setAnimationFinished] = useState(false);
    const [lottieFinished, setLottieFinished] = useState(false);

    useEffect(() => {
        if (onLoaded) onLoaded();
    }, []);

    // Only fade out when BOTH the app is ready AND the Lottie animation has finished
    useEffect(() => {
        if (isReady && lottieFinished) {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                setAnimationFinished(true);
                onAnimationComplete();
            });
        }
    }, [isReady, lottieFinished]);

    if (animationFinished) return null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <LottieView
                source={SplashAnimation}
                autoPlay
                loop={false}
                onAnimationFinish={() => setLottieFinished(true)}
                style={styles.animation}
                resizeMode="cover"
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
    animation: {
        width: width,
        height: height,
    },
});
