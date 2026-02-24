import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const TIWI_LOGO = require('../../assets/images/full logo.svg');

interface LoadingOverlayProps {
    visible: boolean;
    mode?: 'glass' | 'high-contrast';
    onCancel?: () => void;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    visible,
    mode = 'glass',
    onCancel
}) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.8);

    useEffect(() => {
        if (visible) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1,
                true
            );
            opacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 800 }),
                    withTiming(0.6, { duration: 800 })
                ),
                -1,
                true
            );
        } else {
            scale.value = 1;
            opacity.value = 0.8;
        }
    }, [visible]);

    // Handle Back Button (Android)
    useEffect(() => {
        const backAction = () => {
            if (visible && onCancel) {
                onCancel();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [visible, onCancel]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.container}>
                {mode === 'glass' ? (
                    <BlurView
                        intensity={40}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(1, 5, 1, 0.95)' }]} />
                )}

                <Animated.View style={[styles.pulseContainer, animatedStyle]}>
                    <Image
                        source={TIWI_LOGO}
                        style={styles.logo}
                        contentFit="contain"
                    />
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 140,
        height: 140,
    },
});
