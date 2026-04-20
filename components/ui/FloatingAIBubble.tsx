/**
 * Global, draggable AI assistant bubble. Mounted once at the root layout so
 * it's reachable from every authenticated screen. Position is preserved
 * across navigation via module-scoped shared values — navigating away and
 * back doesn't reset the user's placement.
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_SIZE = 48;
const SNAP_PADDING = 20;

// Persist position across mounts/unmounts (e.g., when the bubble is hidden
// on certain routes and later re-shown).
let persistedX: SharedValue<number> | null = null;
let persistedY: SharedValue<number> | null = null;

export function FloatingAIBubble() {
    const router = useRouter();
    const { bottom } = useSafeAreaInsets();

    const translateX = useSharedValue(persistedX?.value ?? 0);
    const translateY = useSharedValue(persistedY?.value ?? 0);
    persistedX = translateX;
    persistedY = translateY;

    const context = useSharedValue({ x: 0, y: 0 });

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;

            const initialY = SCREEN_HEIGHT / 2 + 16.5;
            const nextY = event.translationY + context.value.y;

            const tabAreaHeight = (bottom || 16) + 76;
            const topBoundary = -initialY + 100;
            const bottomBoundary = (SCREEN_HEIGHT - initialY) - tabAreaHeight - BUTTON_SIZE - 20;

            translateY.value = Math.min(Math.max(nextY, topBoundary), bottomBoundary);
        })
        .onEnd(() => {
            const centerX = SCREEN_WIDTH / 2;
            const currentAbsoluteX = SCREEN_WIDTH - BUTTON_SIZE - SNAP_PADDING + translateX.value;

            if (currentAbsoluteX < centerX) {
                translateX.value = withSpring(-(SCREEN_WIDTH - BUTTON_SIZE - SNAP_PADDING * 2));
            } else {
                translateX.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
    }));

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.aiButton, animatedStyle]}>
                <TouchableOpacity
                    onPress={() => router.push('/chatbot' as any)}
                    activeOpacity={0.8}
                    style={styles.aiButtonTouch}
                >
                    <Image
                        source={require('../../assets/home/connect wallet.svg')}
                        style={styles.aiIcon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    aiButton: {
        position: 'absolute',
        right: SNAP_PADDING,
        top: '50%',
        marginTop: 16.5,
        zIndex: 1000,
        elevation: 10,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
    },
    aiButtonTouch: {
        width: '100%',
        height: '100%',
    },
    aiIcon: {
        width: '100%',
        height: '100%',
    },
});
