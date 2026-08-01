/**
 * Earn Screen
 * Main earn/staking page with tab navigation
 * Matches Figma design exactly
 */

import {
    ComingSoon,
    EarnEmptyState,
    EarnTabSwitcher,
    MyPoolsView,
    MyStakeCard,
    StakeDetailsCard,
    StakingPoolAccordion,
    StakingPoolCreator,
    StakingTokenCard,
    TotalStakedCard,
    type EarnTabKey
} from '@/components/sections/Earn';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { TIWI_API_BASE_URL } from '@/lib/mobile/api-client';
import { stakingService, type StakingPool, type UserStake } from '@/services/stakingService';
import { useWalletStore } from '@/store/walletStore';
import { useStakingStore } from '@/store/stakingStore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock token icon - in production, use actual token logo
const TWCIcon = require('../../assets/home/tiwicat.svg');

type StakingSubTab = 'stake' | 'active' | 'my-stakes' | 'create-pool' | 'my-pools';

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
        if (tab === 'active' || tab === 'my-stakes' || tab === 'stake' || tab === 'create-pool' || tab === 'my-pools') {
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

    const { address: walletAddress, walletGroups, activeGroupId } = useWalletStore();
    // The staking deployer + fee/withdraw txns are EVM-only. Resolve the active
    // group's EVM address (falls back to the primary address) for Create Pool /
    // My Pools, which the web equally gates behind an EVM wallet.
    const evmAddress = useMemo(() => {
        const group = walletGroups.find(g => g.id === activeGroupId);
        return group?.addresses?.EVM || walletAddress || null;
    }, [walletGroups, activeGroupId, walletAddress]);
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
        swapWallet,
        liveRewards
    } = useStakingStore();

    // Unread admin/agent replies on the user's staking-support chat. Drives
    // the bell badge on the Staking Support entry card above the stats box.
    // Polling only runs while the Earn screen is focused AND the app is in
    // the foreground — backgrounded tabs do nothing.
    const [supportUnread, setSupportUnread] = useState(0);
    const [isScreenFocused, setIsScreenFocused] = useState(false);
    useFocusEffect(
        useCallback(() => {
            setIsScreenFocused(true);
            return () => setIsScreenFocused(false);
        }, []),
    );

    useEffect(() => {
        if (!walletAddress || !isScreenFocused) {
            return;
        }
        let cancelled = false;
        const fetchUnread = async () => {
            if (AppState.currentState !== 'active') return;
            try {
                const res = await fetch(
                    `${TIWI_API_BASE_URL}/api/v1/staking-support/chats?userWallet=${encodeURIComponent(walletAddress)}`,
                );
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setSupportUnread(data.chat?.unreadUser ?? 0);
            } catch {
                /* polling failures are non-fatal */
            }
        };
        fetchUnread();
        const id = setInterval(fetchUnread, 30_000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [walletAddress, isScreenFocused]);

    // Atomic wallet transition the moment the active wallet changes:
    // a single set() inside swapWallet replaces wallet A's positions/history
    // with wallet B's cached positions/history (or empty if no cache yet).
    // No empty intermediate frame, no badge flicker. Any in-flight fetch
    // tagged for the previous wallet is invalidated by the same call.
    useEffect(() => {
        swapWallet(walletAddress || null);
    }, [walletAddress, swapWallet]);

    const [isLoading, setIsLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch data from backend
    const fetchData = async () => {
        try {
            // Fetch core data and global stats via store
            if (walletAddress) {
                // fetchInitialData already pulls global stats — calling
                // fetchGlobalStats() alongside it duplicated the whole
                // per-pool on-chain crawl on every single load.
                await Promise.all([
                    fetchInitialData(walletAddress),
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

    // Initial load fires once per wallet. Tab and sub-tab switching are pure
    // UI filters over already-loaded state — `activeTab` was in this dep array
    // and made every tab tap refetch the entire staking dataset.
    useEffect(() => {
        loadData();
    }, [walletAddress]);

    // Auto-refresh only while the Earn screen is focused and the app is
    // in the foreground. Backgrounded or other-tab = no refresh.
    useEffect(() => {
        if (!isScreenFocused || activeTab !== 'staking') return;
        const intervalId = setInterval(() => {
            if (AppState.currentState !== 'active') return;
            fetchData();
        }, 30000);
        return () => clearInterval(intervalId);
    }, [isScreenFocused, activeTab, walletAddress]);

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
                    {/* Top Level Category Tabs hidden — only Staking is active for now
                    <View style={{ marginBottom: 8, width: '100%' }}>
                        <EarnTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
                    </View>
                    */}

                    {/* Staking Tab Content */}
                    {activeTab === 'staking' && (
                        <View style={styles.tabContent}>
                            {/* Staking Support entry point — sits above the stats card so
                                users can jump to the help chat from the top of the page.
                                When there are unread admin/agent replies, a bell + counter
                                surfaces on the right. */}
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => router.push('/earn/staking-support' as any)}
                                style={styles.supportEntry}
                            >
                                <View style={styles.supportEntryIcon}>
                                    <Text style={styles.supportEntryIconText}>?</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.supportEntryTitle}>Staking Support</Text>
                                    <Text style={styles.supportEntrySub}>
                                        Need a hand? Chat with our team about staking issues.
                                    </Text>
                                </View>
                                {supportUnread > 0 && (
                                    <View style={styles.supportBellWrap}>
                                        <Ionicons name="notifications" size={18} color="#b1f128" />
                                        <View style={styles.supportBellBadge}>
                                            <Text style={styles.supportBellBadgeText}>
                                                {supportUnread > 9 ? '9+' : String(supportUnread)}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                <Text style={styles.supportEntryChevron}>›</Text>
                            </TouchableOpacity>

                            {/* Create Pool entry point — launches the deployer flow. */}
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => router.push('/earn/create' as any)}
                                style={styles.supportEntry}
                            >
                                <View style={styles.supportEntryIcon}>
                                    <Text style={styles.supportEntryIconText}>+</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.supportEntryTitle}>Create Staking Pool</Text>
                                    <Text style={styles.supportEntrySub}>
                                        Launch your own pool and reward stakers of your token.
                                    </Text>
                                </View>
                                <Text style={styles.supportEntryChevron}>›</Text>
                            </TouchableOpacity>

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

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('create-pool')}
                                    style={[
                                        styles.subTabButton,
                                        { backgroundColor: stakingSubTab === 'create-pool' ? '#081f02' : '#0b0f0a' }
                                    ]}
                                >
                                    <Text style={[styles.subTabText, { color: stakingSubTab === 'create-pool' ? '#b1f128' : '#b5b5b5' }]}>Create Pool</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('my-pools')}
                                    style={[
                                        styles.subTabButton,
                                        { backgroundColor: stakingSubTab === 'my-pools' ? '#081f02' : '#0b0f0a' }
                                    ]}
                                >
                                    <Text style={[styles.subTabText, { color: stakingSubTab === 'my-pools' ? '#b1f128' : '#b5b5b5' }]}>My Pools</Text>
                                </TouchableOpacity>
                            </ScrollView>

                            {/* Cards List Section */}
                            <View style={styles.cardsList}>
                                {stakingSubTab === 'create-pool' ? (
                                    <StakingPoolCreator
                                        activeWalletAddress={evmAddress}
                                        onConnectEvmWallet={() => useWalletStore.getState().setWalletModalVisible(true)}
                                        onViewPools={() => setStakingSubTab('my-pools')}
                                    />
                                ) : stakingSubTab === 'my-pools' ? (
                                    <MyPoolsView
                                        activeWalletAddress={evmAddress}
                                        onConnectEvmWallet={() => useWalletStore.getState().setWalletModalVisible(true)}
                                        onCreatePool={() => setStakingSubTab('create-pool')}
                                    />
                                ) : stakingSubTab === 'stake' ? (
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
                                                    name={pool.name}
                                                    tokenSymbol={pool.tokenSymbol}
                                                    tokenName={pool.tokenName}
                                                    onStakePress={() => router.push(`/earn/stake/${pool.id}` as any)}
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
    supportEntry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#0f130d',
        borderColor: '#1f261e',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    supportEntryIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(177,241,40,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    supportEntryIconText: {
        color: '#b1f128',
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        lineHeight: 20,
    },
    supportEntryTitle: {
        color: '#fff',
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    supportEntrySub: {
        color: '#b5b5b5',
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        marginTop: 2,
    },
    supportEntryChevron: {
        color: '#b5b5b5',
        fontSize: 22,
        marginLeft: 4,
    },
    supportBellWrap: {
        marginRight: 6,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    supportBellBadge: {
        position: 'absolute',
        top: -6,
        right: -8,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    supportBellBadgeText: {
        color: '#fff',
        fontFamily: 'Manrope-Bold',
        fontSize: 10,
        lineHeight: 12,
    },
    cardsList: {
        flexDirection: 'column',
        gap: 16,
    },

});
