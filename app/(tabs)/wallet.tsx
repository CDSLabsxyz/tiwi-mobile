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
import { useTranslation } from '@/hooks/useLocalization';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import {
    fetchNFTs,
    type NFTItem,
} from '@/services/walletService';
import { useFilterStore } from '@/store/filterStore';
import { useWalletStore } from '@/store/walletStore';
import { applyFilters } from '@/utils/assetFilters';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WalletScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams<{ tab?: string }>();
    const queryClient = useQueryClient();

    // Store data (connected wallets)
    const { address, connectedWallets } = useWalletStore();

    // TanStack Query for Balances
    const {
        data: balanceData,
        isLoading: isLoadingBalances,
        isRefetching: isRefetchingBalances
    } = useWalletBalances();

    const tokens = balanceData?.tokens || [];
    const totalNetWorthUsd = balanceData?.totalNetWorthUsd || '0.00';

    // Subscribe to filter store values for reactivity
    const sortBy = useFilterStore((state) => state.sortBy);
    const tokenCategories = useFilterStore((state) => state.tokenCategories);
    const chains = useFilterStore((state) => state.chains);

    // State
    const [nfts, setNfts] = useState<NFTItem[]>([]);
    const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Initialize activeTab from URL params or default to "assets"
    const [activeTab, setActiveTab] = useState<WalletTabKey>(
        (params.tab === 'nfts' ? 'nfts' : 'assets') as WalletTabKey
    );

    // Update activeTab when URL params change
    useEffect(() => {
        if (params.tab === 'nfts' || params.tab === 'assets') {
            setActiveTab(params.tab as WalletTabKey);
        }
    }, [params.tab]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ['walletBalances'] });
        setRefreshing(false);
    }, [queryClient]);

    // Fetch NFTs when NFT tab is active
    useEffect(() => {
        const activeAddress = address || (connectedWallets.length > 0 ? connectedWallets[0].address : null);
        if (activeTab === 'nfts' && nfts.length === 0 && activeAddress) {
            const loadNFTs = async () => {
                setIsLoadingNFTs(true);
                try {
                    const data = await fetchNFTs(activeAddress);
                    setNfts(data);
                } catch (error) {
                    console.error('Failed to fetch NFTs:', error);
                } finally {
                    setIsLoadingNFTs(false);
                }
            };

            loadNFTs();
        }
    }, [activeTab, nfts.length, address, connectedWallets]);

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

    // Map APIToken to PortfolioItem expected by AssetListItem
    const portfolioItems = useMemo(() => {
        return tokens.map(t => ({
            id: `${t.chainId}-${t.address}`,
            symbol: t.symbol,
            name: t.name,
            logo: t.logoURI || 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
            balance: t.balanceFormatted,
            priceUSD: t.priceUSD || '0',
            usdValue: t.usdValue || '0',
            change24h: t.priceChange24h ? parseFloat(t.priceChange24h) : 0,
            chainId: t.chainId === 7565164 ? 'aegis' : (t.chainId === 56 ? 'apex' : 'ethereum'), // Map to local chain keys
        }));
    }, [tokens]);

    // Apply filters to assets
    const filteredAssets = useMemo(() => {
        return applyFilters(
            portfolioItems as any,
            sortBy,
            tokenCategories,
            chains
        );
    }, [
        portfolioItems,
        sortBy,
        Array.from(tokenCategories).join(','),
        Array.from(chains).join(','),
    ]);

    const handleNFTPress = (nft: NFTItem) => {
        console.log('NFT pressed:', nft.id);
    };

    // If no wallets connected, we might want to show a placeholder or prompt
    const displayAddress = address || (connectedWallets.length > 0 ? connectedWallets[0].address : '0x...');

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Sticky Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <WalletHeader
                    walletAddress={displayAddress}
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
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primaryCTA}
                        colors={[colors.primaryCTA]}
                        progressViewOffset={0}
                    />
                }
            >
                {/* Main Content Container */}
                <View style={styles.mainContent}>
                    {/* Top Section: Balance + Quick Actions + Rewards */}
                    <View style={styles.topSection}>
                        <View style={styles.balanceActionsContainer}>
                            {/* Total Balance Card */}
                            <TotalBalanceCard
                                totalBalance={totalNetWorthUsd}
                                portfolioChange={{
                                    amount: "+$0.00",
                                    percent: "+0.00%",
                                    period: "today"
                                }}
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
                            amount="0.00"
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
                                        asset={asset as any}
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
        width: "100%",
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
