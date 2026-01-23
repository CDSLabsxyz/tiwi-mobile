import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { DexMarket } from '@/types';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SmartMarketsSectionProps {
    markets: DexMarket[];
    isLoading?: boolean;
}

/**
 * MarqueeRow Component
 * Handles the seamless looping animation
 */
const MarqueeRow = ({ items, reverse = false, duration = 30000 }: { items: DexMarket[], reverse?: boolean, duration?: number }) => {
    const translateX = useSharedValue(0);
    const [contentWidth, setContentWidth] = React.useState(0);

    // Duplicate items for seamless loop
    const duplicatedItems = [...items, ...items];

    useEffect(() => {
        if (contentWidth > 0) {
            // Reset position
            translateX.value = reverse ? -contentWidth : 0;

            // Start animation
            translateX.value = withRepeat(
                withTiming(reverse ? 0 : -contentWidth, {
                    duration: duration,
                    easing: Easing.linear,
                }),
                -1, // Infinite
                false // Don't reverse back
            );
        }
        return () => cancelAnimation(translateX);
    }, [contentWidth, reverse, duration, translateX]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <View style={styles.marqueeOuter}>
            <Animated.View
                style={[styles.marqueeInner, animatedStyle]}
                onLayout={(e) => {
                    // We only need the width of the original set (half of duplicated)
                    setContentWidth(e.nativeEvent.layout.width / 2);
                }}
            >
                {duplicatedItems.map((market, idx) => (
                    <TouchableOpacity
                        key={`${market.id}-${idx}`}
                        style={styles.marketPill}
                        activeOpacity={0.7}
                    >
                        <Image source={market.logo} style={styles.marketLogo} contentFit="cover" />
                        <Text style={styles.marketName}>{market.name}</Text>
                    </TouchableOpacity>
                ))}
            </Animated.View>
        </View>
    );
};

export const SmartMarketsSection: React.FC<SmartMarketsSectionProps> = ({
    markets,
    isLoading = false,
}) => {
    if (isLoading) {
        return (
            <View style={styles.container}>
                <Skeleton width={112} height={22} borderRadius={4} />
                <View style={styles.skeletonGrid}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} width={110} height={38} borderRadius={100} />
                    ))}
                </View>
            </View>
        );
    }

    // Split into two balanced rows
    const midPoint = Math.ceil(markets.length / 2);
    const firstRow = markets.slice(0, midPoint);
    const secondRow = markets.slice(midPoint);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Smart Markets</Text>
            </View>

            <View style={styles.rowsContainer}>
                {/* First Row - Moves Left */}
                <MarqueeRow items={firstRow} duration={25000} />

                {/* Second Row - Moves Right */}
                <MarqueeRow items={secondRow} reverse duration={30000} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        gap: 12,
        marginVertical: 8,
    },
    header: {
        paddingHorizontal: 20,
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    rowsContainer: {
        gap: 10,
    },
    marqueeOuter: {
        overflow: 'hidden',
        width: SCREEN_WIDTH,
    },
    marqueeInner: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 10,
    },
    marketPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        backgroundColor: colors.bgCards,
    },
    marketLogo: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    marketName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    skeletonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 20,
    },
});
