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
    StakingCarousel,
    StakingTokenCard,
    type EarnTabKey
} from '@/components/sections/Earn';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { stakingService, type StakingPool, type UserStake } from '@/services/stakingService';
import { useWalletStore } from '@/store/walletStore';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Mock token icon - in production, use actual token logo
const TWCIcon = require('../../assets/home/tiwicat.svg');

type StakingSubTab = 'stake' | 'active' | 'my-stakes';

export default function EarnScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState<EarnTabKey>('staking');
    const [stakingSubTab, setStakingSubTab] = useState<StakingSubTab>('stake');

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
    const [isLoading, setIsLoading] = useState(false);
    const [stakingTokens, setStakingTokens] = useState<StakingPool[]>([]);
    const [myStakes, setMyStakes] = useState<UserStake[]>([]);
    const [totalStaked, setTotalStaked] = useState('Loading...');

    // Fetch data from backend
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch total staked once on mount or when sub-tab changes
            stakingService.getTotalTwcStaked().then(setTotalStaked);

            if (stakingSubTab === 'stake') {
                const pools = await stakingService.getActivePools();
                setStakingTokens(pools);
            } else {
                if (walletAddress) {
                    const status = stakingSubTab === 'active' ? 'active' : undefined;
                    const stakes = await stakingService.getUserStakes(walletAddress, status);
                    setMyStakes(stakes);
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [stakingSubTab, walletAddress]);

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
            >
                <View style={styles.mainContent}>
                    {/* Tab Switcher */}
                    <EarnTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Staking Tab Content */}
                    {activeTab === 'staking' && (
                        <View style={styles.tabContent}>
                            {/* Total TWC Staked Card */}
                            <View style={styles.totalStakedCard}>
                                {/* Vertical Divider */}
                                {/* <View style={styles.divider} /> */}

                                {/* Left: Label */}
                                <View style={[styles.column, { borderRightColor: "#273024", borderRightWidth: 1 }]}>
                                    <Text style={styles.labelTWC}>
                                        Total TWC Staked
                                    </Text>
                                </View>

                                {/* Right: Amount */}
                                <View style={[styles.column, { borderLeftColor: "#273024", borderLeftWidth: 1 }]}>
                                    <Text style={styles.amountText}>
                                        {totalStaked}
                                    </Text>
                                </View>
                            </View>

                            {/* Staking Carousel */}
                            <StakingCarousel />

                            {/* Staking Sub Tabs */}
                            <View style={styles.subTabsContainer}>
                                {/* Stake Tab */}
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('stake')}
                                    style={styles.subTab}
                                >
                                    <Text
                                        style={[
                                            styles.subTabText,
                                            { color: stakingSubTab === 'stake' ? colors.titleText : colors.mutedText }
                                        ]}
                                    >
                                        Stake
                                    </Text>
                                    {stakingSubTab === 'stake' && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>

                                {/* Active Positions Tab */}
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('active')}
                                    style={styles.subTab}
                                >
                                    <Text
                                        style={[
                                            styles.subTabText,
                                            { color: stakingSubTab === 'active' ? colors.titleText : colors.mutedText }
                                        ]}
                                    >
                                        Active Positions
                                    </Text>
                                    {stakingSubTab === 'active' && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>

                                {/* My Stakes Tab */}
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setStakingSubTab('my-stakes')}
                                    style={styles.subTab}
                                >
                                    <Text
                                        style={[
                                            styles.subTabText,
                                            { color: stakingSubTab === 'my-stakes' ? colors.titleText : colors.mutedText }
                                        ]}
                                    >
                                        My Stakes
                                    </Text>
                                    {stakingSubTab === 'my-stakes' && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>
                            </View>

                            {/* Staking Token Cards */}
                            {stakingSubTab === 'stake' && (
                                <View style={styles.cardsList}>
                                    {isLoading ? (
                                        <TIWILoader size={80} style={{ marginTop: 20 }} />
                                    ) : stakingTokens.length > 0 ? (
                                        stakingTokens.map((token, index) => (
                                            <StakingTokenCard
                                                key={token.id}
                                                tokenSymbol={token.tokenSymbol}
                                                tokenName={token.tokenName}
                                                apy={token.displayApy}
                                                tokenIcon={token.tokenLogo ? { uri: token.tokenLogo } : TWCIcon}
                                                onPress={() => router.push(`/earn/stake/${token.tokenSymbol}` as any)}
                                            />
                                        ))
                                    ) : (
                                        <EarnEmptyState
                                            title={getEmptyStateMessages('stake').title}
                                            description={getEmptyStateMessages('stake').description}
                                        />
                                    )}
                                </View>
                            )}

                            {/* Active Positions Content */}
                            {stakingSubTab === 'active' && (
                                <View style={styles.cardsList}>
                                    {isLoading ? (
                                        <TIWILoader size={80} style={{ marginTop: 20 }} />
                                    ) : myStakes.length > 0 ? (
                                        myStakes.map((stake, index) => (
                                            <MyStakeCard
                                                key={stake.id}
                                                symbol={stake.pool.tokenSymbol}
                                                apy={stake.displayApy}
                                                icon={stake.pool.tokenLogo ? { uri: stake.pool.tokenLogo } : TWCIcon}
                                                onPress={() => router.push(`/earn/manage/${stake.pool.tokenSymbol}` as any)}
                                            />
                                        ))
                                    ) : (
                                        <EarnEmptyState
                                            title={getEmptyStateMessages('active').title}
                                            description={getEmptyStateMessages('active').description}
                                        />
                                    )}
                                </View>
                            )}

                            {/* My Stakes Content */}
                            {stakingSubTab === 'my-stakes' && (
                                <View style={styles.cardsList}>
                                    {isLoading ? (
                                        <TIWILoader size={80} style={{ marginTop: 20 }} />
                                    ) : myStakes.length > 0 ? (
                                        myStakes.map((stake, index) => (
                                            <MyStakeCard
                                                key={stake.id}
                                                symbol={stake.pool.tokenSymbol}
                                                apy={stake.displayApy}
                                                icon={stake.pool.tokenLogo ? { uri: stake.pool.tokenLogo } : TWCIcon}
                                                onPress={() => router.push(`/earn/manage/${stake.pool.tokenSymbol}` as any)}
                                            />
                                        ))
                                    ) : (
                                        <EarnEmptyState
                                            title={getEmptyStateMessages('my-stakes').title}
                                            description={getEmptyStateMessages('my-stakes').description}
                                        />
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Coming Soon Tabs */}
                    {(activeTab === 'farming' ||
                        activeTab === 'lend-borrow' ||
                        activeTab === 'nft-staking') && <ComingSoon />}
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
    totalStakedCard: {
        backgroundColor: colors.bgSemi,
        borderWidth: 0.5,
        borderColor: '#273024',
        height: 56,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        position: 'relative',
    },
    column: {
        flex: 1,
        alignItems: 'center',
    },
    labelTWC: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.primaryCTA,
        letterSpacing: -0.64,
    },
    amountText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
        letterSpacing: -0.64,
    },
    subTabsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    subTab: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
    },
    subTabText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
    },
    activeIndicator: {
        height: 1,
        width: 16,
        backgroundColor: colors.primaryCTA,
    },
    cardsList: {
        flexDirection: 'column',
        gap: 16,
    },

});
