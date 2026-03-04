/**
 * My Stake Card Component
 * Represents a single staking position in the "My Stakes" list
 * Matches Figma design (node-id: 1606:4541)
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/constants/colors';

interface MyStakeCardProps {
    symbol: string;
    apy: string;
    stakedAmount?: string;
    rewardsEarned?: string;
    lockPeriod?: string;
    icon: any;
    onPress: () => void;
    earningRate?: number; // Optional: for real-time mining UI
}

const ChevronRightIcon = require('../../../assets/home/arrow-down-01.svg'); // Design specified this icon

export const MyStakeCard: React.FC<MyStakeCardProps> = ({
    symbol,
    apy,
    stakedAmount = "0",
    rewardsEarned = "0",
    lockPeriod = "N/A",
    icon,
    onPress,
    earningRate = 0
}) => {
    // Local real-time mining state
    const [liveRewards, setLiveRewards] = React.useState(parseFloat(rewardsEarned.split(' ')[0]) || 0);

    React.useEffect(() => {
        if (earningRate <= 0) return;

        const interval = setInterval(() => {
            setLiveRewards(prev => prev + (earningRate / 10)); // Increment every 100ms for smoothness
        }, 100);
        return () => clearInterval(interval);
    }, [earningRate]);

    // Sync with props if they change significantly
    React.useEffect(() => {
        setLiveRewards(parseFloat(rewardsEarned.split(' ')[0]) || 0);
    }, [rewardsEarned]);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.container}
        >
            {/* Top Row: Token, APY, Chevron */}
            <View style={styles.topRow}>
                <View style={styles.leftContent}>
                    <Image
                        source={icon}
                        style={styles.tokenIcon}
                        contentFit="cover"
                    />
                    <Text style={styles.symbolText}>{symbol}</Text>
                </View>

                <View style={styles.rightHeader}>
                    <Text style={styles.apyText}>{apy}</Text>
                    <Image
                        source={ChevronRightIcon}
                        style={styles.actionIcon}
                        contentFit="contain"
                    />
                </View>
            </View>

            {/* Bottom Row: Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statItem, { flex: 1.2 }]}>
                    <Text style={styles.statLabel}>STAKED</Text>
                    <Text style={styles.statValue}>{stakedAmount}</Text>
                </View>
                <View style={[styles.statItem, { flex: 1.5 }]}>
                    <Text style={styles.statLabel}>REWARDS</Text>
                    <Text style={[styles.statValue, { color: colors.primaryCTA }]}>
                        {earningRate > 0 ? liveRewards.toFixed(6) : rewardsEarned.split(' ')[0]} {symbol}
                    </Text>
                </View>
                <View style={[styles.statItem, { flex: 1, alignItems: 'flex-end' }]}>
                    <Text style={styles.statLabel}>LOCK PERIOD</Text>
                    <Text style={styles.statValue}>{lockPeriod}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        padding: 16,
        gap: 12,
        marginBottom: 8,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tokenIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    symbolText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    rightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    apyText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.titleText,
    },
    actionIcon: {
        width: 20,
        height: 20,
        tintColor: colors.mutedText,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    statItem: {
        gap: 2,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    statValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
        color: 'white',
    },
});

