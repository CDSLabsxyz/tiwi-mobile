import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { StatCard } from '@/types';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
];

export const TradeStatsSection: React.FC<TradeStatsSectionProps> = ({
    stats,
    isLoading = false,
}) => {
    if (isLoading) {
        return (
            <View style={styles.container}>
                <Skeleton width={159} height={22} borderRadius={4} />
                <View style={styles.row}>
                    <Skeleton width={172} height={101} borderRadius={16} />
                    <Skeleton width={172} height={101} borderRadius={16} />
                </View>
            </View>
        );
    }

    const firstRow = stats.slice(0, 2);
    const secondRow = stats.slice(2);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Trade Without Limits</Text>

            <View style={styles.row}>
                {firstRow.map((stat) => (
                    <View key={stat.id} style={styles.card}>
                        {stat.id === '2' ? (
                            <View style={styles.chainGroup}>
                                <View style={styles.chainIcons}>
                                    {chainLogos.map((logo, i) => (
                                        <Image key={i} source={logo} style={styles.chainLogo} />
                                    ))}
                                </View>
                                <View>
                                    <Text style={styles.statValue}>{stat.value}</Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.statContent}>
                                <Image source={stat.iconType === 'image' ? stat.icon : iconMap[stat.icon || '']} style={styles.statIcon} />
                                <View>
                                    <Text style={styles.statValue}>{stat.value}</Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            <View style={styles.row}>
                {secondRow.map((stat) => (
                    <View key={stat.id} style={[styles.card, { flex: 1 }]}>
                        <Image source={iconMap[stat.icon || '']} style={styles.statIconSmall} />
                        <View>
                            <Text style={styles.statValue}>{stat.value}</Text>
                            <Text style={styles.statLabel}>{stat.label}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        gap: 8,
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
    card: {
        flex: 1,
        padding: 12,
        borderRadius: 16,
        backgroundColor: colors.bgCards,
        gap: 10,
    },
    chainGroup: {
        gap: 10,
    },
    chainIcons: {
        flexDirection: 'row',
        gap: -8, // Overlap chains
    },
    chainLogo: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.bgCards,
    },
    statContent: {
        gap: 10,
    },
    statIcon: {
        width: 24,
        height: 24,
    },
    statIconSmall: {
        width: 20,
        height: 20,
        marginBottom: 8,
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
});
