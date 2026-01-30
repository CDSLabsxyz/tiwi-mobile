import { colors } from '@/constants/colors';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface PasscodeFieldProps {
    length?: number;
    passcode: string;
    isError?: boolean;
}

export const PasscodeField: React.FC<PasscodeFieldProps> = ({ length = 6, passcode, isError = false }) => {
    const shake = useSharedValue(0);

    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shake.value }],
    }));

    useEffect(() => {
        if (isError) {
            shake.value = withTiming(-10, { duration: 50 }, () => {
                shake.value = withTiming(10, { duration: 50 }, () => {
                    shake.value = withTiming(-10, { duration: 50 }, () => {
                        shake.value = withTiming(10, { duration: 50 }, () => {
                            shake.value = withTiming(0, { duration: 50 });
                        });
                    });
                });
            });
        }
    }, [isError]);

    return (
        <Animated.View style={[styles.container, shakeStyle]}>
            {Array.from({ length }).map((_, index) => (
                <PasscodeBox
                    key={index}
                    active={index === passcode.length}
                    filled={index < passcode.length}
                    isError={isError}
                />
            ))}
        </Animated.View>
    );
};

const PasscodeBox = ({ active, filled, isError }: { active: boolean; filled: boolean; isError: boolean }) => {
    const scale = useSharedValue(1);

    useEffect(() => {
        if (active) {
            scale.value = withSpring(1.05);
        } else {
            scale.value = withTiming(1);
        }
    }, [active]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        borderColor: isError
            ? colors.error
            : active
                ? colors.primaryCTA
                : filled
                    ? '#666666'
                    : '#333333',
        backgroundColor: active ? '#1A1A1A' : 'transparent',
    }));

    return (
        <Animated.View style={[styles.box, animatedStyle]}>
            {filled && <View style={styles.dot} />}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 40,
        width: '100%',
    },
    box: {
        width: 48,
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
    },
});
