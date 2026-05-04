/**
 * Earn Staking Details Screen
 * Displays detailed information about a specific staking pool/position
 * Matches Figma nodes: 3279:111518, 3279:111691, 3279:111839, 3279:111891
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stakingService, type StakingPool } from '@/services/stakingService';

// Icons
const BackIcon = require('../../assets/swap/arrow-left-02.svg');
const CopyIcon = require('../../assets/wallet/copy-01.svg'); // Assuming this exists, generic copy icon
// const InfoIcon = require('../../assets/home/info-circle.svg'); // Check if exists, fallback if not

// Mock Token Icon
const TWCIcon = require('../../assets/home/tiwicat.svg');

type DetailTab = 'stakers' | 'finished-pools';

interface Staker {
    address: string;
    amount: string;
    date: string;
}

interface FinishedPool {
    symbol: string;
    status: string;
    stakersCount: string;
}

const MOCK_STAKERS: Staker[] = [
    { address: '0x2...121fe7', amount: '10.43K', date: '6/9/2025' },
    { address: '0x2...121fe7', amount: '10.43K', date: '6/9/2025' },
    { address: '0x2...121fe7', amount: '10.43K', date: '6/9/2025' },
    { address: '0x2...121fe7', amount: '10.43K', date: '6/9/2025' },
    { address: '0x2...121fe7', amount: '10.43K', date: '6/9/2025' },
];

const MOCK_FINISHED_POOLS: FinishedPool[] = [
    { symbol: 'TWC', status: 'Ended', stakersCount: '240' },
];

export default function EarnDetailScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { symbol } = useLocalSearchParams<{ symbol: string }>();
    const [activeTab, setActiveTab] = useState<DetailTab>('stakers');
    // Resolve admin pool name (if any) from the live API so the header can
    // show "TWC Genesis Pool" instead of just the symbol.
    const [pool, setPool] = useState<StakingPool | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (!symbol) return;
        // Param is the pool DB UUID for new links; fall back to symbol
        // lookup so older links still resolve.
        stakingService.getPoolByIdOrSymbol(symbol).then((p) => {
            if (!cancelled) setPool(p ?? null);
        }).catch(() => { /* keep mock display on failure */ });
        return () => { cancelled = true; };
    }, [symbol]);

    // The route param is now a pool DB UUID for new links — never display it
    // directly in the header. Prefer the loaded pool's actual token symbol.
    const looksLikeUuid = !!symbol && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(symbol);
    const displaySymbol = pool?.tokenSymbol || (looksLikeUuid ? '' : symbol) || '';

    // Stats
    const stats = {
        tvl: '$1.4M',
        apr: '5.48%',
        totalStaked: '1.1M TWC',
        limits: '0.03-50 TWC',
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.8}
                >
                    <Image source={BackIcon} style={styles.icon} contentFit="contain" />
                </TouchableOpacity>

                <View style={styles.tokenHeader}>
                    <Image source={TWCIcon} style={styles.tokenIcon} contentFit="cover" />
                    <View style={styles.headerTitleColumn}>
                        <Text style={styles.tokenTagText} numberOfLines={1}>
                            {pool?.name || displaySymbol || 'TWC'}
                        </Text>
                        {!!pool?.name && !!displaySymbol && (
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                {displaySymbol}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: bottom + 24 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Stats Card */}
                <View style={styles.statsCardWrapper}>
                    <View style={styles.statsCard}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>TVL</Text>
                            <Text style={styles.statValue}>{stats.tvl}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>APR</Text>
                            <Text style={styles.statValue}>{stats.apr}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Staked</Text>
                            <Text style={styles.statValue}>{stats.totalStaked}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Limits</Text>
                            <Text style={styles.statValue}>{stats.limits}</Text>
                        </View>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('stakers')}
                        style={styles.tabButton}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'stakers' ? styles.tabTextActive : styles.tabTextInactive
                            ]}
                        >
                            Stakers
                        </Text>
                        {activeTab === 'stakers' && <View style={styles.activeIndicator} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab('finished-pools')}
                        style={styles.tabButton}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'finished-pools' ? styles.tabTextActive : styles.tabTextInactive
                            ]}
                        >
                            Finished Pools
                        </Text>
                        {activeTab === 'finished-pools' && <View style={styles.activeIndicator} />}
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {activeTab === 'stakers' && (
                    <View style={styles.listContainer}>
                        {/* List Header */}
                        <View style={styles.listHeader}>
                            <Text style={[styles.listHeaderLabel, { flex: 2 }]}>Stakers List</Text>
                            <Text style={[styles.listHeaderLabel, { flex: 1, textAlign: 'center' }]}>Staked Amount</Text>
                            <Text style={[styles.listHeaderLabel, { flex: 1, textAlign: 'right' }]}>Date</Text>
                        </View>

                        {MOCK_STAKERS.map((staker, index) => (
                            <View key={index} style={styles.listItem}>
                                <View style={[styles.cell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                    <Text style={styles.addressText}>{staker.address}</Text>
                                    <TouchableOpacity>
                                        <Image source={CopyIcon} style={styles.microIcon} contentFit="contain" />
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.cell, { flex: 1, alignItems: 'center' }]}>
                                    <Text style={styles.cellText}>{staker.amount}</Text>
                                </View>
                                <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                                    <Text style={styles.cellText}>{staker.date}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {activeTab === 'finished-pools' && (
                    <View style={styles.listContainer}>
                        {/* List Header */}
                        <View style={styles.listHeader}>
                            <Text style={[styles.listHeaderLabel, { flex: 2 }]}>Pools</Text>
                            <Text style={[styles.listHeaderLabel, { flex: 1, textAlign: 'center' }]}>Time</Text>
                            <Text style={[styles.listHeaderLabel, { flex: 1, textAlign: 'right' }]}>Stakers</Text>
                        </View>

                        {/* MOCK EMPTY STATE - Uncomment to test empty state */}
                        {/* <EarnEmptyState description="You haven’t created any pools" /> */}

                        {MOCK_FINISHED_POOLS.map((pool, index) => (
                            <View key={index} style={styles.listItem}>
                                <View style={[styles.cell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                    <Image source={TWCIcon} style={styles.miniIcon} contentFit="cover" />
                                    <Text style={styles.cellText}>{pool.symbol}</Text>
                                </View>
                                <View style={[styles.cell, { flex: 1, alignItems: 'center' }]}>
                                    <Text style={styles.cellText}>{pool.status}</Text>
                                </View>
                                <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                                    <Text style={styles.cellText}>{pool.stakersCount}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    tokenHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flex: 1,
        minWidth: 0,
        marginHorizontal: 8,
    },
    headerTitleColumn: {
        flexShrink: 1,
        minWidth: 0,
    },
    headerSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 11,
        color: colors.mutedText,
        marginTop: 1,
    },
    tokenIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    tokenTag: {
        position: 'absolute',
        bottom: -4,
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    tokenTagText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 10,
        color: colors.titleText,
    },
    scrollView: {
        flex: 1,
    },
    statsCardWrapper: {
        paddingHorizontal: 20,
        marginTop: 20,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: '#273024',
        borderRadius: 12,
        paddingVertical: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.bodyText,
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
    },
    divider: {
        width: 1,
        height: '100%',
        backgroundColor: '#273024',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 24,
        gap: 24,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    tabButton: {
        paddingBottom: 12,
        position: 'relative',
    },
    tabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    tabTextActive: {
        color: colors.titleText,
    },
    tabTextInactive: {
        color: colors.mutedText,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: colors.primaryCTA,
    },
    listContainer: {
        paddingHorizontal: 20,
        marginTop: 16,
        gap: 16,
    },
    listHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
    },
    listHeaderLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    cell: {
        // Flex handled inline
    },
    addressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    cellText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    microIcon: {
        width: 14,
        height: 14,
        tintColor: colors.mutedText,
    },
    miniIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
});
