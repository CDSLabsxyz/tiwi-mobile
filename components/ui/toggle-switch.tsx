import { colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface ToggleSwitchProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
}

export function ToggleSwitch({ value, onValueChange }: ToggleSwitchProps) {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onValueChange(!value);
    };

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: withTiming(value ? 16 : 0) }],
        backgroundColor: withTiming(value ? colors.primaryCTA : '#4e634b'),
    }));

    const trackStyle = useAnimatedStyle(() => ({
        borderColor: withTiming(value ? colors.primaryCTA : '#4e634b'),
    }));

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePress}
            style={styles.container}
        >
            <Animated.View style={[styles.track, trackStyle]}>
                <Animated.View style={[styles.thumb, thumbStyle]} />
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    track: {
        width: 40,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        backgroundColor: 'transparent',
        padding: 2,
        justifyContent: 'center',
    },
    thumb: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
});
