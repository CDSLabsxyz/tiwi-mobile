/**
 * Total Staked Card
 * 6-stat grid — ports super-app's total-staked-card.tsx:
 *   OVERALL TVL | NO. OF ACTIVE POOLS | NO. OF INACTIVE POOLS
 *   TOTAL TWC STAKED | TOTAL NO. OF ACTIVE STAKERS | ALL TIME STAKERS
 * On mobile we collapse the single-row desktop layout to a 2x3 grid.
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
    allTimeStakersCount?: string;
    tokenSymbol?: string;
    isLoading?: boolean;
}

export const TotalStakedCard: React.FC<TotalStakedCardProps> = ({
    overallTvl = '0',
    maxTvl,
    activePoolsCount = '0',
    inactivePoolsCount = '0',
    totalTwcStaked = '0',
    activeStakersCount = '0',
    allTimeStakersCount = '0',
    tokenSymbol = 'TWC',
    isLoading = false,
}) => {
    // The super-app displays Overall TVL via the `maxTvl` field (the cap across
    // every pool). Keep back-compat if the caller only passes `maxTvl`.
    const tvlValue = maxTvl ?? overallTvl;

    const renderStat = (
        label: string,
        value: string | number,
        suffix: string,
        opts?: { valueColor?: string; skeletonWidth?: number },
    ) => (
        <View style={styles.cell}>
            <Text style={styles.label} numberOfLines={2}>{label}</Text>
            {isLoading ? (
                <Skeleton width={opts?.skeletonWidth ?? 60} height={18} />
            ) : (
                <Text style={[styles.value, opts?.valueColor ? { color: opts.valueColor } : null]} numberOfLines={1}>
                    {value}
                </Text>
            )}
            <Text style={styles.suffix}>{suffix}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                {renderStat('OVERALL TVL', tvlValue, tokenSymbol, { skeletonWidth: 80 })}
                <View style={styles.divider} />
                {renderStat('NO. OF ACTIVE POOLS', activePoolsCount, 'POOLS', { valueColor: colors.primaryCTA, skeletonWidth: 40 })}
                <View style={styles.divider} />
                {renderStat('NO. OF INACTIVE POOLS', inactivePoolsCount, 'POOLS', { valueColor: '#E8A838', skeletonWidth: 40 })}
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
                {renderStat('TOTAL TWC STAKED', totalTwcStaked, tokenSymbol, { skeletonWidth: 80 })}
                <View style={styles.divider} />
                {renderStat('ACTIVE STAKERS', activeStakersCount, 'USERS', { skeletonWidth: 50 })}
                <View style={styles.divider} />
                {renderStat('ALL TIME STAKERS', allTimeStakersCount, 'USERS', { skeletonWidth: 50 })}
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
        paddingVertical: 14,
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowDivider: {
        height: 0.5,
        backgroundColor: '#1f261e',
        marginVertical: 10,
        marginHorizontal: 8,
    },
    divider: {
        width: 0.5,
        alignSelf: 'stretch',
        backgroundColor: '#1f261e',
    },
    cell: {
        flex: 1,
        paddingVertical: 4,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    label: {
        color: '#7c7c7c',
        fontSize: 9,
        fontFamily: 'Manrope-Medium',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    value: {
        color: '#FFF',
        fontSize: 15,
        fontFamily: 'Manrope-Bold',
        textAlign: 'center',
    },
    suffix: {
        color: '#7c7c7c',
        fontSize: 8,
        fontFamily: 'Manrope-Regular',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
});
