/**
 * Total Staked Card Component
 * 5-stat grid matching web app design
 */

import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

interface TotalStakedCardProps {
    overallTvl?: string;
    maxTvl?: string;
    activePoolsCount?: number | string;
    inactivePoolsCount?: number | string;
    totalTwcStaked?: string;
    activeStakersCount?: string;
    tokenSymbol?: string;
    isLoading?: boolean;
}

export const TotalStakedCard: React.FC<TotalStakedCardProps> = ({
    overallTvl = "0",
    maxTvl = "0",
    activePoolsCount = "0",
    inactivePoolsCount = "0",
    totalTwcStaked = "0",
    activeStakersCount = "0",
    tokenSymbol = "TWC",
    isLoading = false
}) => {
    return (
        <View style={styles.container}>
            {/* Row 1: 2 columns */}
            <View style={styles.row}>
                <View style={[styles.statItem, styles.borderRight, styles.borderBottom]}>
                    <Text style={styles.statLabel}>OVERALL TVL</Text>
                    {isLoading ? <Skeleton width={80} height={20} /> : (
                        <Text style={styles.statValue}>{maxTvl}</Text>
                    )}
                    <Text style={styles.tokenLabel}>{tokenSymbol}</Text>
                </View>
                <View style={[styles.statItem, styles.borderBottom]}>
                    <Text style={styles.statLabel}>NO. OF ACTIVE POOLS</Text>
                    {isLoading ? <Skeleton width={40} height={20} /> : (
                        <Text style={[styles.statValue, { color: colors.primaryCTA }]}>{activePoolsCount}</Text>
                    )}
                    <Text style={styles.tokenLabel}>POOLS</Text>
                </View>
            </View>

            {/* Row 2: 2 columns */}
            <View style={styles.row}>
                <View style={[styles.statItem, styles.borderRight, styles.borderBottom]}>
                    <Text style={styles.statLabel}>NO. OF INACTIVE POOLS</Text>
                    {isLoading ? <Skeleton width={40} height={20} /> : (
                        <Text style={[styles.statValue, { color: '#E8A838' }]}>{inactivePoolsCount}</Text>
                    )}
                    <Text style={styles.tokenLabel}>POOLS</Text>
                </View>
                <View style={[styles.statItem, styles.borderBottom]}>
                    <Text style={styles.statLabel}>TOTAL TWC STAKED</Text>
                    {isLoading ? <Skeleton width={80} height={20} /> : (
                        <Text style={styles.statValue}>{totalTwcStaked}</Text>
                    )}
                    <Text style={styles.tokenLabel}>{tokenSymbol}</Text>
                </View>
            </View>

            {/* Row 3: 1 column centered */}
            <View style={styles.row}>
                <View style={styles.statItemFull}>
                    <Text style={styles.statLabel}>TOTAL NO. OF ACTIVE STAKERS</Text>
                    {isLoading ? <Skeleton width={60} height={20} /> : (
                        <Text style={styles.statValue}>{activeStakersCount}</Text>
                    )}
                    <Text style={styles.tokenLabel}>USERS</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#0b0f0a',
        borderWidth: 0.5,
        borderColor: '#273024',
        borderRadius: 16,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
    },
    statItem: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statItemFull: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    borderRight: {
        borderRightWidth: 0.5,
        borderRightColor: '#1f261e',
    },
    borderBottom: {
        borderBottomWidth: 0.5,
        borderBottomColor: '#1f261e',
    },
    statLabel: {
        color: '#7c7c7c',
        fontSize: 9,
        fontFamily: 'Manrope-Medium',
        marginBottom: 4,
        textAlign: 'center',
    },
    statValue: {
        color: 'white',
        fontSize: 16,
        fontFamily: 'Manrope-Bold',
        textAlign: 'center',
    },
    tokenLabel: {
        color: '#7c7c7c',
        fontSize: 8,
        fontFamily: 'Manrope-Regular',
        marginTop: 2,
    },
});
