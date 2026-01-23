import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { StatCard } from '@/types';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';


const SECTION_WIDTH = 353;

interface TradeStatsSectionProps {
    stats: StatCard[];
    isLoading?: boolean;
}

const iconMap: Record<string, any> = {
    'trade-up': require('../../../assets/home/trade-up.svg'),
    'coins': require('../../../assets/home/coins-01.svg'),
    'locked': require('../../../assets/home/locked.svg'),
};

const chainLogos = [
    require('../../../assets/home/chains/ethereum.svg'),
    require('../../../assets/home/chains/solana.svg'),
    require('../../../assets/home/chains/polygon.svg'),
    require('../../../assets/home/chains/avalanche.svg'),
    require('../../../assets/home/chains/bsc.svg'),
    require('../../../assets/home/chains/sui.svg'),
    require('../../../assets/home/chains/near.svg'),
    require('../../../assets/home/chains/bitcoin.svg'),
];

/**
 * ChainMarquee Component
 * Animates the overlapping chain logos in one direction
 */
const ChainMarquee = () => {
    const translateX = useSharedValue(0);
    const itemWidth = 34; // 24 (icon) + 10 (gap)
    const totalContentWidth = chainLogos.length * itemWidth;

    useEffect(() => {
        translateX.value = withRepeat(
            withTiming(-totalContentWidth, {
                duration: 15000,
                easing: Easing.linear,
            }),
            -1,
            false
        );
        return () => cancelAnimation(translateX);
    }, [totalContentWidth, translateX]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <View style={styles.chainMarqueeContainer}>
            <Animated.View style={[styles.chainMarqueeInner, animatedStyle]}>
                {[...chainLogos, ...chainLogos].map((logo, index) => (
                    <Image
                        key={index}
                        source={logo}
                        style={styles.chainLogo}
                        contentFit="cover"
                    />
                ))}
            </Animated.View>
        </View>
    );
};

export const TradeStatsSection: React.FC<TradeStatsSectionProps> = ({
    stats,
    isLoading = false,
}) => {
    if (isLoading) {
        return (
            <View style={styles.container}>
                <Skeleton width={159} height={22} borderRadius={4} />
                <View style={styles.row}>
                    <Skeleton width={172.5} height={101} borderRadius={16} />
                    <Skeleton width={172.5} height={101} borderRadius={16} />
                </View>
                <View style={styles.row}>
                    <Skeleton width={112.33} height={94} borderRadius={16} />
                    <Skeleton width={112.33} height={94} borderRadius={16} />
                    <Skeleton width={112.33} height={94} borderRadius={16} />
                </View>
            </View>
        );
    }

    const firstRow = stats.slice(0, 2);
    const secondRow = stats.slice(2);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Trade Without Limits</Text>

            {/* First Row: 2 Cards */}
            <View style={styles.row}>
                {firstRow.map((stat) => (
                    <View key={stat.id} style={styles.largeCard}>
                        {stat.id === '2' ? (
                            <View style={styles.statContent}>
                                <ChainMarquee />
                                <View style={styles.labelsContainer}>
                                    <Text style={styles.statValue}>{stat.value}</Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.statContent}>
                                {stat.icon && (
                                    <Image
                                        source={stat.iconType === 'image' ? stat.icon : iconMap[stat.icon]}
                                        style={styles.iconRegular}
                                        contentFit="contain"
                                    />
                                )}
                                <View style={styles.labelsContainer}>
                                    <Text style={[styles.statValue, { fontSize: stat.id === '1' ? 18 : 16 }]}>
                                        {stat.value}
                                    </Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {/* Second Row: 3 Cards */}
            <View style={styles.row}>
                {secondRow.map((stat) => (
                    <View key={stat.id} style={styles.smallCard}>
                        <View style={styles.statContent}>
                            {stat.icon && iconMap[stat.icon] && (
                                <Image
                                    source={iconMap[stat.icon]}
                                    style={styles.iconSmall}
                                    contentFit="contain"
                                />
                            )}
                            <View style={styles.labelsContainer}>
                                <Text style={styles.statValueSmall}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: SECTION_WIDTH,
        gap: 12,
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    largeCard: {
        flex: 1,
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 12,
        height: 101,
        justifyContent: 'center',
    },
    smallCard: {
        flex: 1,
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 10,
        height: 94,
        justifyContent: 'center',
    },
    statContent: {
        gap: 10,
    },
    labelsContainer: {
        gap: 2,
    },
    chainMarqueeContainer: {
        height: 24,
        overflow: 'hidden',
    },
    chainMarqueeInner: {
        flexDirection: 'row',
        gap: 10,
    },
    chainLogo: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    iconRegular: {
        width: 24,
        height: 24,
    },
    iconSmall: {
        width: 20,
        height: 20,
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.titleText,
        fontSize: 16,
    },
    statValueSmall: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.titleText,
        fontSize: 15,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        color: colors.bodyText,
        fontSize: 12,
    },
});
