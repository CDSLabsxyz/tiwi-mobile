import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    const lottieRef = useRef<LottieView>(null);

    useEffect(() => {
        if (onLoaded) onLoaded();
    }, []);

    const handleAnimationFinish = useCallback(() => {
        setLottieFinished(true);
    }, []);

    useEffect(() => {
        if (isReady && lottieFinished) {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }).start(() => {
                setAnimationFinished(true);
                onAnimationComplete();
            });
        }
    }, [isReady, lottieFinished]);

    if (animationFinished) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim }
            ]}
        >
            <LottieView
                ref={lottieRef}
                source={SplashAnimation}
                autoPlay
                loop={false}
                onAnimationFinish={handleAnimationFinish}
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
