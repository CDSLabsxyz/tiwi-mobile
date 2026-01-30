import { colors } from '@/constants/colors';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PasscodeDotsProps {
    length: number;
    passcode: string;
}

export const PasscodeDots: React.FC<PasscodeDotsProps> = ({ length = 6, passcode }) => {
    return (
        <View style={styles.container}>
            {Array.from({ length }).map((_, index) => (
                <Dot key={index} active={index < passcode.length} />
            ))}
        </View>
    );
};

const Dot = ({ active }: { active: boolean }) => {
    const scale = useSharedValue(1);
    const color = useSharedValue(colors.bgStroke); // Inactive color

    useEffect(() => {
        scale.value = withSpring(active ? 1.2 : 1);
        // color.value = withTiming(active ? colors.primaryCTA : '#333333'); 
    }, [active]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: active ? '#FFFFFF' : '#1A1A1A', // White when active, Dark Grey when inactive
        borderColor: active ? '#FFFFFF' : '#333333',
    }));

    return <Animated.View style={[styles.dot, animatedStyle]} />;
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 40,
    },
    dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
});
