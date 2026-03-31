import { colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Extrapolate,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

const ArrowDown01 = require('@/assets/home/arrow-down-01.svg');

interface SwapDetailsCardProps {
    gasFee?: string;
    slippageTolerance?: string;
    twcFee?: string;
    isLoading?: boolean;
    isRefreshing?: boolean;
    isStale?: boolean;
    lastFetchTime?: number;
}

const RefreshIndicator = ({ isRefreshing, isStale, lastFetchTime }: { isRefreshing: boolean, isStale: boolean, lastFetchTime?: number }) => {
    const [secondsAgo, setSecondsAgo] = useState(0);

    useEffect(() => {
        if (!lastFetchTime) return;
        const interval = setInterval(() => {
            setSecondsAgo(Math.floor((Date.now() - lastFetchTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [lastFetchTime]);

    if (!lastFetchTime) return null;

    return (
        <View style={styles.refreshIndicator}>
            {isStale ? (
                <View style={styles.staleWrapper}>
                    <Ionicons name="warning" size={12} color={colors.error} />
                    <Text style={styles.staleText}>Price Stale</Text>
                </View>
            ) : isRefreshing ? (
                <Text style={styles.refreshingText}>Refreshing...</Text>
            ) : (
                <Text style={styles.timeAgoText}>Updating in {secondsAgo}s</Text>
            )}
        </View>
    );
};

/**
 * Swap Details Card with expand/collapse animation
 * Always visible - shows default values when no quote
 */
export const SwapDetailsCard: React.FC<SwapDetailsCardProps> = ({
    gasFee,
    slippageTolerance,
    twcFee,
    isLoading = false,
    isRefreshing = false,
    isStale = false,
    lastFetchTime,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const rotation = useSharedValue(0);
    const height = useSharedValue(0);
    const pulseOpacity = useSharedValue(0.3);

    useEffect(() => {
        if (isLoading) {
            pulseOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.7, { duration: 1000 }),
                    withTiming(0.3, { duration: 1000 })
                ),
                -1,
                false
            );
        } else {
            pulseOpacity.value = 0.3;
        }
    }, [isLoading]);

    const toggleExpanded = () => {
        const toValue = isExpanded ? 0 : 1;
        setIsExpanded(!isExpanded);
        rotation.value = withTiming(toValue === 1 ? 180 : 0, { duration: 300 });
        height.value = withTiming(toValue, { duration: 300 });
    };

    const arrowStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const contentStyle = useAnimatedStyle(() => {
        const expandedHeight = 180; // Increased significantly to ensure "Updating in Xs" and all rows are visible
        const collapsedHeight = 0;
        const animatedHeight = interpolate(height.value, [0, 1], [collapsedHeight, expandedHeight], Extrapolate.CLAMP);
        const opacity = interpolate(height.value, [0, 0.3, 1], [0, 0, 1], Extrapolate.CLAMP);
        return {
            height: animatedHeight + 12,
            opacity: opacity,
            overflow: 'hidden',
        };
    });

    const skeletonStyle = useAnimatedStyle(() => ({
        opacity: pulseOpacity.value,
    }));

    const displayGasFee = isLoading ? undefined : (gasFee || '$0.00');
    const displaySlippage = isLoading ? undefined : (slippageTolerance || '0%');
    const displayTwcFee = isLoading ? undefined : (twcFee || '$0.00');

    return (
        <View style={styles.container}>
            <TouchableOpacity activeOpacity={0.8} onPress={toggleExpanded} style={styles.toggleButton}>
                <Text style={styles.toggleText}>
                    {isExpanded ? 'Show Less' : 'Show More'}
                </Text>
                <Animated.View style={[styles.arrowContainer, arrowStyle]}>
                    <Image source={ArrowDown01} style={styles.fullSize} contentFit="contain" />
                </Animated.View>
            </TouchableOpacity>

            <Animated.View style={[styles.card, contentStyle]}>
                <View style={styles.detailsContent}>
                    {/* Freshness Indicator */}
                    {!isLoading && (
                        <RefreshIndicator
                            isRefreshing={isRefreshing}
                            isStale={isStale}
                            lastFetchTime={lastFetchTime}
                        />
                    )}

                    {/* Gas Fee */}
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Gas Fee</Text>
                        {isLoading ? (
                            <Animated.View style={[styles.skeletonSmall, skeletonStyle]} />
                        ) : (
                            <Text style={[styles.detailValue, (isRefreshing || isStale) && { opacity: 0.6 }]}>{displayGasFee}</Text>
                        )}
                    </View>


                    {/* Slippage */}
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Slippage Tolerance</Text>
                        {isLoading ? (
                            <Animated.View style={[styles.skeletonSmall, skeletonStyle]} />
                        ) : (
                            <Text style={[styles.detailValue, (isRefreshing || isStale) && { opacity: 0.6 }]}>{displaySlippage}</Text>
                        )}
                    </View>

                    {/* Protocol Fee */}
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Protocol Fee</Text>
                        {isLoading ? (
                            <Animated.View style={[styles.skeletonSmall, skeletonStyle]} />
                        ) : (
                            <Text style={[styles.detailValue, (isRefreshing || isStale) && { opacity: 0.6 }]}>{displayTwcFee}</Text>
                        )}
                    </View>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
        alignSelf: 'center',
        marginTop: 12,
        gap: 12,
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    toggleText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.bodyText,
    },
    arrowContainer: {
        width: 16,
        height: 16,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    card: {
        width: '100%',
        backgroundColor: colors.bgStroke,
        borderRadius: 12,
        padding: 12,
    },
    detailsContent: {
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    detailLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.bodyText,
    },
    detailValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.primaryCTA,
    },
    sourceWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sourceBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 0.5,
    },
    bestBadge: {
        backgroundColor: colors.accentDark40,
        borderColor: colors.accentDark40,
    },
    otherBadge: {
        backgroundColor: 'transparent',
        borderColor: colors.primaryCTA,
    },
    firstBadge: {
        borderTopLeftRadius: 2,
        borderBottomLeftRadius: 2,
    },
    lastBadge: {
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    sourceText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 8,
        color: colors.primaryCTA,
    },
    skeletonSmall: {
        width: 60,
        height: 10,
        borderRadius: 4,
        backgroundColor: colors.bgCards,
    },
    skeletonMedium: {
        width: 80,
        height: 10,
        borderRadius: 4,
        backgroundColor: colors.bgCards,
    },
    refreshIndicator: {
        marginBottom: 8,
        alignItems: 'flex-end',
    },
    staleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    staleText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        color: colors.error,
    },
    refreshingText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.primaryCTA,
    },
    timeAgoText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
});
