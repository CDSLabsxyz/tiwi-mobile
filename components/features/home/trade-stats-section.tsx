import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { ChainItem } from '@/lib/mobile/api-client';
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
    chains?: ChainItem[];
    isLoading?: boolean;
}

const iconMap: Record<string, any> = {
    'trade-up': require('../../../assets/home/trade-up.svg'),
    'coins': require('../../../assets/home/coins-01.svg'),
    'locked': require('../../../assets/home/locked.svg'),
};

const localChainLogos = [
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
const ChainMarquee = ({ chains = [] }: { chains?: ChainItem[] }) => {
    const translateX = useSharedValue(0);
    const itemWidth = 34; // 24 (icon) + 10 (gap)

    // Use dynamic logos from API if available, otherwise fallback to local icons
    const logos = chains.length > 0
        ? chains.map(c => c.logoURI || c.logo).filter(Boolean)
        : localChainLogos;

    const totalContentWidth = logos.length * itemWidth;

    useEffect(() => {
        if (logos.length === 0) return;

        translateX.value = withRepeat(
            withTiming(-totalContentWidth, {
                duration: Math.max(logos.length * 1500, 5000), // Adjust speed based on item count
                easing: Easing.linear,
            }),
            -1,
            false
        );
        return () => cancelAnimation(translateX);
    }, [totalContentWidth, translateX, logos.length]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    if (logos.length === 0) return <View style={styles.chainMarqueeContainer} />;

    return (
        <View style={styles.chainMarqueeContainer}>
            <Animated.View style={[styles.chainMarqueeInner, animatedStyle]}>
                {[...logos, ...logos].map((logo, index) => (
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
    chains = [],
    isLoading = false,
}) => {
    const { t } = useTranslation();

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

    // Layout logic: 2 cards in first row, up to 3 in subsequent rows
    const firstRow = stats.slice(0, 2);
    const otherRows = [];
    for (let i = 2; i < stats.length; i += 3) {
        otherRows.push(stats.slice(i, i + 3));
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('home.trade_without_limits')}</Text>

            {/* First Row: 2 Cards */}
            <View style={styles.row}>
                {firstRow.map((stat) => (
                    <View key={stat.id} style={styles.largeCard}>
                        {stat.id === 'chain-count' ? (
                            <View style={styles.statContent}>
                                <ChainMarquee chains={chains} />
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
                                    <Text numberOfLines={1} style={[styles.statValue, { fontSize: stat.id === 'twc-price' ? 18 : 16 }]}>
                                        {stat.value}
                                    </Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {/* Subsequent Rows: 3 Cards each */}
            {otherRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                    {row.map((stat) => (
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
                                    <Text numberOfLines={1} style={styles.statValueSmall}>{stat.value}</Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                    {/* Fill remaining space if row has less than 3 cards */}
                    {row.length < 3 && Array(3 - row.length).fill(0).map((_, i) => (
                        <View key={`empty-${i}`} style={[styles.smallCard, { backgroundColor: 'transparent' }]} />
                    ))}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: "100%",
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
