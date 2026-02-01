import { colors } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export const TokenSkeleton = () => {
    const animatedValue = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
    });

    return (
        <View style={styles.container}>
            <View style={styles.leftInfo}>
                <View style={styles.iconCircle}>
                    <Animated.View style={[styles.shimmer, { transform: [{ translateX }] }]}>
                        <LinearGradient
                            colors={['transparent', 'rgba(255,255,255,0.05)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                </View>
                <View style={styles.textColumn}>
                    <View style={styles.titleLine} />
                    <View style={styles.subtitleLine} />
                </View>
            </View>
            <View style={styles.rightInfo}>
                <View style={styles.titleLineSmall} />
                <View style={styles.subtitleLineSmall} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 76,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        overflow: 'hidden',
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    textColumn: {
        gap: 8,
    },
    titleLine: {
        width: 80,
        height: 14,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    subtitleLine: {
        width: 120,
        height: 10,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    rightInfo: {
        alignItems: 'flex-end',
        gap: 8,
    },
    titleLineSmall: {
        width: 60,
        height: 14,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    subtitleLineSmall: {
        width: 40,
        height: 10,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
        width: '200%',
    },
});
