import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const SplashVideo = require('../../assets/GIF/Splash_Screen.mp4');
const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
    isReady: boolean;
    onAnimationComplete: () => void;
    onLoaded?: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ isReady, onAnimationComplete, onLoaded }) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [animationFinished, setAnimationFinished] = useState(false);
    const [videoFinished, setVideoFinished] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    const player = useVideoPlayer(SplashVideo, (p) => {
        p.loop = false;
        p.play();
    });

    useEffect(() => {
        const subscription = player.addListener('playToEnd', () => {
            setVideoFinished(true);
        });

        // Trigger onLoaded as soon as we have some status/metadata
        const statusSub = player.addListener('statusChange', (status) => {
            if (status === 'readyToPlay' && !hasStarted) {
                setHasStarted(true);
                if (onLoaded) onLoaded();
            }
        });

        return () => {
            subscription.remove();
            statusSub.remove();
        };
    }, [player, onLoaded, hasStarted]);

    useEffect(() => {
        // We only exit when BOTH the Video has finished playing AND the app is ready.
        if (isReady && videoFinished) {
            // Exit Animation: Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 800, 
                useNativeDriver: true,
            }).start(() => {
                setAnimationFinished(true);
                onAnimationComplete();
            });
        }
    }, [isReady, videoFinished]);

    if (animationFinished) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim }
            ]}
        >
            <VideoView
                player={player}
                style={styles.video}
                contentFit="contain"
                allowsFullscreen={false}
                allowsPictureInPicture={false}
                useNativeControls={false}
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
    video: {
        width: width,
        height: height,
    },
});
