/**
 * Earn Screen
 * Main earn/staking page with tab navigation
 * Matches Figma design exactly
 */

import {
    ComingSoon,
    EarnEmptyState,
    EarnTabSwitcher,
    MyStakeCard,
    StakeDetailsCard,
    StakingPoolAccordion,
    StakingTokenCard,
    TotalStakedCard,
    type EarnTabKey
} from '@/components/sections/Earn';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { stakingService, type StakingPool, type UserStake } from '@/services/stakingService';
import { useWalletStore } from '@/store/walletStore';
import { useStakingStore } from '@/store/stakingStore';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock token icon - in production, use actual token logo
const TWCIcon = require('../../assets/home/tiwicat.svg');

type StakingSubTab = 'stake' | 'active' | 'my-stakes';

export default function EarnScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const { tab } = useLocalSearchParams<{ tab: string }>();
    const [activeTab, setActiveTab] = useState<EarnTabKey>('staking');
    const [stakingSubTab, setStakingSubTab] = useState<StakingSubTab>('stake');
    // Tracks which StakeDetailsCard is expanded on the Active Positions / My Stakes tabs.
    // Matches the super-app which auto-expands the first card in the list.
    const [expandedStakeId, setExpandedStakeId] = useState<string | null>(null);

    // Handle deep-link tab switching (e.g., from staking success)
    useEffect(() => {
        if (tab === 'active' || tab === 'my-stakes' || tab === 'stake') {
            setStakingSubTab(tab as StakingSubTab);
            setActiveTab('staking');
            fetchData(); // Trigger immediate fetch
        }
    }, [tab]);

    const handleSettingsPress = () => {
        const currentRoute = pathname || '/earn';
        router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
    };

    const handleScanPress = () => {
        // TODO: Implement iris scan functionality
        console.log('Iris scan pressed');
    };

    const handleWalletPress = () => {
        useWalletStore.getState().setWalletModalVisible(true);
    };

    const { address: walletAddress } = useWalletStore();
    const {
        activePositions,
        historicalStakes,
        activePools,
        globalStats,
        isLoading: isStoreLoading,
        isGlobalStatsLoading,
        fetchInitialData,
        fetchGlobalStats,
        fetchHistoricalStakes,
        resetUserStakes,
        liveRewards
    } = useStakingStore();

    // Wipe cached active/historical stakes the moment the active wallet
    // changes so the UI never shows the previous wallet's positions while
    // the refetch for the new wallet is in flight.
    useEffect(() => {
        resetUserStakes();
    }, [walletAddress, resetUserStakes]);

    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch data from backend
    const fetchData = async () => {
        try {
            // Fetch core data and global stats via store
            if (walletAddress) {
                await Promise.all([
                    fetchInitialData(walletAddress),
                    fetchGlobalStats(),
                    fetchHistoricalStakes(walletAddress),
                ]);
                // NOTE: the on-chain discoverPositions() crawler is intentionally
                // not called here. The DB is the source of truth for Active
                // Positions — mirrors the super-app which never merges phantom
                // on-chain rows into the list. If the user wants to inspect
                // on-chain state for a specific pool, the manage screen reads
                // from the contract directly.
            } else {
                await fetchGlobalStats();
            }
        } catch (error) {
            console.error('[Earn] Data fetch failed:', error);
        }
    };

    const loadData = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        await fetchData();
        if (showLoading) setIsLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    useEffect(() => {
        loadData();

        // Real-time auto-refresh every 30 seconds
        const intervalId = setInterval(() => {
            fetchData();
        }, 30000);

        return () => clearInterval(intervalId);
    }, [stakingSubTab, walletAddress, activeTab]);

    // Auto-expand the first stake whenever the relevant list changes, so users
    // land on a useful view instead of a pile of collapsed rows.
    useEffect(() => {
        if (stakingSubTab === 'active' && activePositions.length > 0) {
            setExpandedStakeId(activePositions[0].id);
        } else if (stakingSubTab === 'my-stakes' && historicalStakes.length > 0) {
            setExpandedStakeId(historicalStakes[0].id);
        } else {
            setExpandedStakeId(null);
        }
    }, [stakingSubTab, activePositions, historicalStakes]);

    // Helper for contextual empty states
    const getEmptyStateMessages = (tab: StakingSubTab) => {
        switch (tab) {
            case 'stake':
                return {
                    title: "No Staking Pools",
                    description: "There are no active staking pools available at the moment."
                };
            case 'active':
                return {
                    title: "No Active Positions",
                    description: "You don't have any active staking positions right now."
                };
            case 'my-stakes':
                return {
                    title: "No Stake History",
                    description: "You haven't staked any tokens yet. Start staking to earn rewards!"
                };
            default:
                return {
                    title: "No Pools found",
                    description: "No staking pools found."
                };
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header */}
            <View style={{ paddingTop: top }}>
                <Header
                    walletAddress={walletAddress!}
                    onScanPress={handleScanPress}
                    onSettingsPress={handleSettingsPress}
                    onWalletPress={handleWalletPress}
                />
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: bottom + 100 } // Extra padding for tab bar
                ]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primaryCTA}
                        colors={[colors.primaryCTA]}
                    />
                }
            >
                <View style={styles.mainContent}>
                    {/* Top Level Category Tabs (Staking, Farming, etc) */}
                    <View style={{ marginBottom: 8, width: '100%' }}>
                        <EarnTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
                    </View>

                    {/* Staking Tab Content */}
                    {activeTab === 'staking' && (
                        <View style={styles.tabContent}>
                            {/* Total Staked Card (Web-style mobile grid) */}
                            <TotalStakedCard
                                overallTvl={globalStats.overallTvl}
                                maxTvl={globalStats.maxTvl}
                                activePoolsCount={globalStats.activePoolsCount}
                                inactivePoolsCount={globalStats.inactivePoolsCount}
                                totalTwcStaked={globalStats.totalTwcStaked}
                                activeStakersCount={globalStats.activeStakersCount}
                                allTimeStakersCount={globalStats.allTimeStakersCount}
                                isLoading={isGlobalStatsLoading}
                                tokenSymbol="TWC"
                            />

                            {/* Staking Sub Tabs (Matches ActionButtons on Web) */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.subTabsContainer}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('stake')}
                                    style={[
                                        styles.subTabButton,
                                        { backgroundColor: stakingSubTab === 'stake' ? '#081f02' : '#0b0f0a' }
                                    ]}
                                >
                                    <Text style={[styles.subTabText, { color: stakingSubTab === 'stake' ? '#b1f128' : '#b5b5b5' }]}>Stake</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('active')}
                                    style={[
                                        styles.subTabButton,
                                        { backgroundColor: stakingSubTab === 'active' ? '#081f02' : '#0b0f0a' }
                                    ]}
                                >
                                    <Text style={[styles.subTabText, { color: stakingSubTab === 'active' ? '#b1f128' : '#b5b5b5' }]}>Active Positions</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('my-stakes')}
                                    style={[
                                        styles.subTabButton,
                                        { backgroundColor: stakingSubTab === 'my-stakes' ? '#081f02' : '#0b0f0a' }
                                    ]}
                                >
                                    <Text style={[styles.subTabText, { color: stakingSubTab === 'my-stakes' ? '#b1f128' : '#b5b5b5' }]}>My Stakes</Text>
                                </TouchableOpacity>
                            </ScrollView>

                            {/* Cards List Section */}
                            <View style={styles.cardsList}>
                                {stakingSubTab === 'stake' ? (
                                    activePools.length > 0 ? (
                                        activePools
                                            // Show the pool if it has either a V2 per-pool contract
                                            // address OR a legacy on-chain numeric poolId. Rows that
                                            // have neither can't be staked into yet.
                                            .filter((pool) => !!pool.poolContractAddress || (pool.poolId !== undefined && pool.poolId !== null))
                                            .map((pool) => (
                                                <StakingPoolAccordion
                                                    key={pool.id}
                                                    poolId={(pool.poolContractAddress ? pool.id : pool.poolId) as string | number}
                                                    poolContractAddress={pool.poolContractAddress}
                                                    decimals={pool.decimals}
                                                    tokenSymbol={pool.tokenSymbol}
                                                    tokenName={pool.tokenName}
                                                    onStakePress={() => router.push(`/earn/stake/${pool.tokenSymbol}` as any)}
                                                />
                                            ))
                                    ) : (
                                        <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: 20 }}>
                                            No available pools
                                        </Text>
                                    )
                                ) : stakingSubTab === 'active' ? (
                                    activePositions.length > 0 ? (
                                        activePositions.map((pos) => (
                                            <StakeDetailsCard
                                                key={pos.id}
                                                stake={pos}
                                                variant="active"
                                                isExpanded={expandedStakeId === pos.id}
                                                onToggle={() => setExpandedStakeId(expandedStakeId === pos.id ? null : pos.id)}
                                            />
                                        ))
                                    ) : (
                                        <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: 20 }}>
                                            No active positions found
                                        </Text>
                                    )
                                ) : (
                                    historicalStakes.length > 0 ? (
                                        historicalStakes.map((pos) => (
                                            <StakeDetailsCard
                                                key={pos.id}
                                                stake={pos}
                                                variant="history"
                                                isExpanded={expandedStakeId === pos.id}
                                                onToggle={() => setExpandedStakeId(expandedStakeId === pos.id ? null : pos.id)}
                                            />
                                        ))
                                    ) : (
                                        <Text style={{ color: colors.mutedText, textAlign: 'center', marginTop: 20 }}>
                                            You don't have any completed or withdrawn stakes yet.
                                        </Text>
                                    )
                                )}
                            </View>
                        </View>
                    )}

                    {/* Coming Soon Tabs */}
                    {activeTab !== 'staking' && <ComingSoon />}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    mainContent: {
        width: '100%',
        maxWidth: 500,
        flexDirection: 'column',
        gap: 24,
    },
    tabContent: {
        flexDirection: 'column',
        gap: 24,
    },
    subTabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 4,
    },
    subTabButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80,
    },
    subTabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    cardsList: {
        flexDirection: 'column',
        gap: 16,
    },

});
