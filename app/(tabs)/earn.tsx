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
import { colors } from '@/constants/colors';
import { WALLET_ADDRESS } from '@/utils/wallet';
import { usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
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
        // This usually opens the wallet selection modal
    };

    // Mock data - in production, fetch from API
    const totalStaked = '213,111,612 TWC';
    const stakingTokens = [
        {
            symbol: 'TWC',
            name: 'TIWI',
            apy: '~12.5%',
            icon: TWCIcon,
        },
    ];

    const myStakes = [
        { symbol: 'TWC', name: 'TIWI', apy: '~12.5%', icon: TWCIcon },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header */}
            <View style={{ paddingTop: top }}>
                <Header
                    walletAddress={WALLET_ADDRESS}
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
                                    {stakingTokens.map((token, index) => (
                                        <StakingTokenCard
                                            key={index}
                                            tokenSymbol={token.symbol}
                                            tokenName={token.name}
                                            apy={token.apy}
                                            tokenIcon={token.icon}
                                            onPress={() => router.push(`/earn/stake/${token.symbol}` as any)}
                                        />
                                    ))}
                                </View>
                            )}

                            {/* Active Positions Content */}
                            {stakingSubTab === 'active' && (
                                <View style={styles.cardsList}>
                                    {myStakes.map((stake, index) => (
                                        <MyStakeCard
                                            key={index}
                                            symbol={stake.symbol}
                                            apy={stake.apy}
                                            icon={stake.icon}
                                            onPress={() => router.push(`/earn/manage/${stake.symbol}` as any)}
                                        />
                                    ))}
                                </View>
                            )}

                            {/* My Stakes Content */}
                            {stakingSubTab === 'my-stakes' && (
                                myStakes.length > 0 ? (
                                    <View style={styles.cardsList}>
                                        {myStakes.map((stake, index) => (
                                            <MyStakeCard
                                                key={index}
                                                symbol={stake.symbol}
                                                apy={stake.apy}
                                                icon={stake.icon}
                                                onPress={() => router.push(`/earn/manage/${stake.symbol}` as any)}
                                            />
                                        ))}
                                    </View>
                                ) : (
                                    <EarnEmptyState description="You haven’t created any pools" />
                                )
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
        maxWidth: 400,
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
