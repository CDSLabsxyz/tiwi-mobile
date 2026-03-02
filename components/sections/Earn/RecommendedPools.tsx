/**
 * Recommended Pools Section
 * Matches the web app's recommended pools component
 */

import { colors } from '@/constants/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { PoolCard } from './PoolCard';
import type { StakingPool } from '@/services/stakingService';

const TWCIcon = require('../../../assets/home/tiwicat.svg');

interface RecommendedPoolsProps {
    pools: StakingPool[];
    isLoading?: boolean;
    onPoolClick?: (pool: StakingPool) => void;
}

export const RecommendedPools: React.FC<RecommendedPoolsProps> = ({
    pools = [],
    isLoading = false,
    onPoolClick,
}) => {
    // Show only first few pools as recommended (or logic-based)
    const recommended = pools.slice(0, 2);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="fire" size={24} color="white" />
                <Text style={styles.headerText}>Recommended</Text>
            </View>

            {isLoading ? (
                <View style={styles.grid}>
                    <View style={styles.skeleton} />
                    <View style={styles.skeleton} />
                </View>
            ) : recommended.length === 0 ? (
                <Text style={styles.emptyText}>No pools available</Text>
            ) : (
                <View style={styles.grid}>
                    {recommended.map((pool) => (
                        <PoolCard
                            key={pool.id}
                            tokenName={pool.tokenSymbol}
                            tokenIcon={pool.tokenLogo ? { uri: pool.tokenLogo } : TWCIcon}
                            apy={pool.displayApy}
                            onPress={() => onPoolClick?.(pool)}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: 16,
        paddingHorizontal: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    headerText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: 'white',
    },
    grid: {
        flexDirection: 'row',
        gap: 12,
    },
    skeleton: {
        flex: 1,
        height: 100,
        backgroundColor: '#121712',
        borderRadius: 16,
    },
    emptyText: {
        color: colors.mutedText,
        fontSize: 14,
        fontFamily: 'Manrope-Regular',
        marginLeft: 4,
    },
});
