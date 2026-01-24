/**
 * Wallet Screen
 * Main wallet screen displaying balance, quick actions, and asset portfolio
 * Converted from Tailwind to StyleSheet - matches reference implementation exactly
 */

import {
    AssetListItem,
    AssetsTabSwitcher,
    ClaimableRewardsCard,
    NFTList,
    QuickActions,
    TotalBalanceCard,
    WalletHeader,
    type WalletTabKey,
} from '@/components/sections/Wallet';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import {
    fetchNFTs,
    fetchWalletData,
    type NFTItem,
    type WalletData,
} from '@/services/walletService';
import { useFilterStore } from '@/store/filterStore';
import { applyFilters } from '@/utils/assetFilters';
import { WALLET_ADDRESS } from '@/utils/wallet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WalletScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ tab?: string }>();

    // Subscribe to filter store values for reactivity
    const sortBy = useFilterStore((state) => state.sortBy);
    const tokenCategories = useFilterStore((state) => state.tokenCategories);
    const chains = useFilterStore((state) => state.chains);

    // State
    const [walletData, setWalletData] = useState<WalletData | null>(null);
    const [nfts, setNfts] = useState<NFTItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    // Initialize activeTab from URL params or default to "assets"
    const [activeTab, setActiveTab] = useState<WalletTabKey>(
        (params.tab === 'nfts' ? 'nfts' : 'assets') as WalletTabKey
    );

    // Update activeTab when URL params change (e.g., when navigating back)
    useEffect(() => {
        if (params.tab === 'nfts' || params.tab === 'assets') {
            setActiveTab(params.tab as WalletTabKey);
        }
    }, [params.tab]);

    // Fetch wallet data
    useEffect(() => {
        const loadWalletData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchWalletData(WALLET_ADDRESS);
                setWalletData(data);
            } catch (error) {
                console.error('Failed to fetch wallet data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadWalletData();
    }, []);

    // Fetch NFTs when NFT tab is active
    useEffect(() => {
        if (activeTab === 'nfts' && nfts.length === 0) {
            const loadNFTs = async () => {
                setIsLoadingNFTs(true);
                try {
                    const data = await fetchNFTs(WALLET_ADDRESS);
                    setNfts(data);
                } catch (error) {
                    console.error('Failed to fetch NFTs:', error);
                } finally {
                    setIsLoadingNFTs(false);
                }
            };

            loadNFTs();
        }
    }, [activeTab, nfts.length]);

    // Handlers
    const handleToggleVisibility = () => {
        setIsBalanceVisible(!isBalanceVisible);
    };

    const handleIrisScanPress = () => {
        console.log('Iris scan pressed');
    };

    const handleSettingsPress = () => {
        router.push('/settings' as any);
    };

    const handleSendPress = () => {
        router.push('/send' as any);
    };

    const handleReceivePress = () => {
        router.push('/receive' as any);
    };

    const handlePayPress = () => {
        console.log('Pay pressed');
    };

    const handleActivitiesPress = () => {
        router.push("/wallet/activities" as any);
    };

    const handleRewardsPress = () => {
        console.log('Rewards pressed');
    };

    const handleFilterPress = () => {
        console.log('Filter pressed');
    };

    const handleTabChange = (tab: WalletTabKey) => {
        setActiveTab(tab);
    };

    const handleTodayPress = () => {
        console.log('Today pressed');
    };

    // Apply filters to assets - reactive to filter changes
    const filteredAssets = useMemo(() => {
        if (!walletData) return [];
        return applyFilters(
            walletData.portfolio,
            sortBy,
            tokenCategories,
            chains
        );
    }, [
        walletData,
        sortBy,
        Array.from(tokenCategories).join(','),
        Array.from(chains).join(','),
    ]);

    const handleNFTPress = (nft: NFTItem) => {
        console.log('NFT pressed:', nft.id);
    };

    if (isLoading || !walletData) {
        return (
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
                <CustomStatusBar />
                <View style={styles.loadingContainer} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Sticky Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <WalletHeader
                    walletAddress={walletData.address}
                    onIrisScanPress={handleIrisScanPress}
                    onSettingsPress={handleSettingsPress}
                />
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: (bottom || 16) + 76 + 24 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Main Content Container (356px width from Figma, centered) */}
                <View style={styles.mainContent}>
                    {/* Top Section: Balance + Quick Actions + Rewards */}
                    <View style={styles.topSection}>
                        {/* Balance + Quick Actions Container */}
                        <View style={styles.balanceActionsContainer}>
                            {/* Total Balance Card */}
                            <TotalBalanceCard
                                totalBalance={walletData.totalBalance}
                                portfolioChange={walletData.portfolioChange}
                                isBalanceVisible={isBalanceVisible}
                                onToggleVisibility={handleToggleVisibility}
                                onTodayPress={handleTodayPress}
                            />

                            {/* Quick Actions */}
                            <QuickActions
                                onSendPress={handleSendPress}
                                onReceivePress={handleReceivePress}
                                onPayPress={handlePayPress}
                                onActivitiesPress={handleActivitiesPress}
                            />
                        </View>

                        {/* Claimable Rewards Card */}
                        <ClaimableRewardsCard
                            amount={walletData.claimableRewards}
                            onPress={handleRewardsPress}
                        />
                    </View>

                    {/* Assets Section */}
                    <View style={styles.assetsSection}>
                        {/* Tab Switcher */}
                        <AssetsTabSwitcher
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            onFilterPress={handleFilterPress}
                        />

                        {/* Asset List */}
                        {activeTab === 'assets' && (
                            <View style={styles.assetList}>
                                {filteredAssets.map((asset) => (
                                    <AssetListItem
                                        key={asset.id}
                                        asset={asset}
                                        onPress={() => {
                                            console.log('Asset pressed:', asset.id);
                                        }}
                                    />
                                ))}
                            </View>
                        )}

                        {/* NFTs Tab */}
                        {activeTab === 'nfts' && (
                            <View style={styles.nftContainer}>
                                {isLoadingNFTs ? (
                                    <View style={styles.loadingContainer} />
                                ) : (
                                    <NFTList nfts={nfts} onNFTPress={handleNFTPress} />
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        backgroundColor: colors.bg,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 24,
        alignItems: 'center',
        gap: 24,
    },
    mainContent: {
        width: 356,
        maxWidth: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
    },
    topSection: {
        width: '100%',
        flexDirection: 'column',
        gap: 18,
        alignItems: 'center',
    },
    balanceActionsContainer: {
        width: '100%',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'center',
    },
    assetsSection: {
        width: '100%',
        flexDirection: 'column',
        gap: 18,
    },
    assetList: {
        width: '100%',
        flexDirection: 'column',
        gap: 4,
    },
    nftContainer: {
        width: '100%',
        flexDirection: 'column',
        gap: 6,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
