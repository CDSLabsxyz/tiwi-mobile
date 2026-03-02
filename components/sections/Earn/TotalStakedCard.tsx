/**
 * Total Staked Card Component
 * Matches the tiwi-super-app design for stats grid
 */

import { colors } from '@/constants/colors';
import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';

interface TotalStakedCardProps {
    overallTvl?: string;
    maxTvl?: string;
    activePoolsCount?: number | string;
    totalTwcStaked?: string;
    activeStakersCount?: string;
    tokenSymbol?: string;
    isLoading?: boolean;
}

export const TotalStakedCard: React.FC<TotalStakedCardProps> = ({
    overallTvl = "0",
    maxTvl = "0",
    activePoolsCount = "0",
    totalTwcStaked = "0",
    activeStakersCount = "0",
    tokenSymbol = "TWC",
    isLoading = false
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                {/* Column 1: Overall TVL */}
                <View style={[styles.statItem, styles.borderRight, styles.borderBottom]}>
                    <Text style={styles.statLabel}>OVERALL TVL</Text>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.primaryCTA} />
                    ) : (
                        <Text style={styles.statValue}>{maxTvl}</Text>
                    )}
                    <Text style={styles.tokenLabel}>{tokenSymbol}</Text>
                </View>

                {/* Column 2: No. of Active Pools */}
                <View style={[styles.statItem, styles.borderBottom]}>
                    <Text style={styles.statLabel}>NO. OF ACTIVE POOLS</Text>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.primaryCTA} />
                    ) : (
                        <Text style={[styles.statValue, { color: colors.primaryCTA }]}>{activePoolsCount}</Text>
                    )}
                    <Text style={styles.tokenLabel}>POOLS</Text>
                </View>

                {/* Column 3: Total TWC Staked */}
                <View style={[styles.statItem, styles.borderRight]}>
                    <Text style={styles.statLabel}>TOTAL TWC STAKED</Text>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.primaryCTA} />
                    ) : (
                        <Text style={styles.statValue}>{totalTwcStaked}</Text>
                    )}
                    <Text style={styles.tokenLabel}>{tokenSymbol}</Text>
                </View>

                {/* Column 4: Total No. of Active Stakers */}
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>TOTAL ACTIVE STAKERS</Text>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.primaryCTA} />
                    ) : (
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
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    statItem: {
        width: '50%',
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    borderRight: {
        borderRightWidth: 0.5,
        borderColor: '#1f261e',
    },
    borderBottom: {
        borderBottomWidth: 0.5,
        borderColor: '#1f261e',
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
