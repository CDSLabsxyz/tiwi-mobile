import {
    AssetListItem,
    AssetsTabSwitcher,
    ClaimableRewardsCard,
    NFTList,
    QuickActions,
    TotalBalanceCard,
    WalletFilterSheet,
    type WalletTabKey,
} from '@/components/sections/Wallet';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTranslation } from '@/hooks/useLocalization';
import { useTokens } from '@/hooks/useTokens';
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
    const { address, walletGroups = [] } = useWalletStore();

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
    const [activeTab, setActiveTab] = useState<WalletTabKey>((params.tab as WalletTabKey) || 'assets');
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);
    const [isFilterVisible, setIsFilterVisible] = useState(false);
    const [nfts, setNfts] = useState<NFTItem[]>([]);
    const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);

    // Filtered items
    const filteredTokens = useMemo(() => {
        return applyFilters(tokens, { sortBy, tokenCategories, chains });
    }, [tokens, sortBy, tokenCategories, chains]);

    const filteredNFTs = useMemo(() => {
        return applyFilters(nfts, { sortBy, tokenCategories, chains });
    }, [nfts, sortBy, tokenCategories, chains]);

    // UI Handlers
    const handleToggleVisibility = () => setIsBalanceVisible(!isBalanceVisible);
    const handleTodayPress = () => { };
    const handleAssetPress = (asset: any) => {
        const assetId = asset.address || asset.id;
        router.push({
            pathname: `/asset/${assetId}` as any,
            params: {
                id: asset.address,
                symbol: asset.symbol,
                name: asset.name,
                balance: asset.balanceFormatted, // USE formatted balance (not raw BigInt)
                usdValue: asset.usdValue,
                chainId: asset.chainId,
                logo: asset.logoURI, // USE logoURI
                priceUSD: asset.priceUSD,
                change24h: asset.priceChange24h
            }
        });
    };

    const handleRefresh = useCallback(async () => {
        queryClient.invalidateQueries({ queryKey: ['walletBalances'] });
        if (activeTab === 'nfts' && address) {
            loadNFTs(address);
        }
    }, [activeTab, address, queryClient]);

    const loadNFTs = async (walletAddress: string) => {
        setIsLoadingNFTs(true);
        try {
            const items = await fetchNFTs(walletAddress);
            setNfts(items);
        } catch (error) {
            console.error('Failed to fetch NFTs:', error);
        } finally {
            setIsLoadingNFTs(false);
        }
    };

    const handleNFTPress = (nft: any) => {
        router.push(`/nft/${nft.id}?tab=nfts`);
    };

    // Effects
    useEffect(() => {
        if (params.tab) setActiveTab(params.tab as WalletTabKey);
    }, [params.tab]);

    useEffect(() => {
        if (activeTab === 'nfts' && address) {
            loadNFTs(address);
        }
    }, [activeTab, address]);

    // Prefetch for Receive Screen (Tokens and Chains)
    const supportedEcosystems = useMemo(() =>
        (walletGroups || []).map(w => w.primaryChain?.toLowerCase() || 'evm'),
        [walletGroups]);

    const supportedChainIds = useMemo(() => {
        const ids: number[] = [];
        const ecos = supportedEcosystems || [];
        if (ecos.includes('evm')) ids.push(1, 56, 137, 42161);
        if (ecos.includes('solana')) ids.push(1399811149);
        return ids;
    }, [supportedEcosystems]);

    // Pre-warm React Query cache for tokens and chains
    useChains(supportedEcosystems);
    useTokens({
        chains: supportedChainIds,
        enabled: supportedChainIds.length > 0 && !!address,
        limit: 50
    });

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <Header
                onWalletPress={() => useWalletStore.getState().setWalletModalVisible(true)}
                onSettingsPress={() => router.push('/settings')}
                onScanPress={() => { }}
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 20 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetchingBalances || isLoadingNFTs}
                        onRefresh={handleRefresh}
                        tintColor={colors.primaryCTA}
                    />
                }
            >
                <View style={[styles.innerContent, { paddingBottom: bottom + 100 }]}>
                    {/* Total Balance Card */}
                    <TotalBalanceCard
                        totalBalance={totalNetWorthUsd}
                        portfolioChange={{
                            amount: balanceData?.portfolioChange?.amount || "0.00",
                            percent: balanceData?.portfolioChange?.percent || "0.00",
                            period: "today"
                        }}
                        isBalanceVisible={isBalanceVisible}
                        onToggleVisibility={handleToggleVisibility}
                        onTodayPress={handleTodayPress}
                    />

                    {/* Quick Actions */}
                    <QuickActions
                        onSendPress={() => router.push('/send')}
                        onReceivePress={() => router.push('/receive')}
                        onPayPress={() => { /* TODO: Implement Pay logic */ }}
                        onActivitiesPress={() => router.push('/activities')}
                    />

                    {/* Claimable Rewards */}
                    <ClaimableRewardsCard amount="0.00" />

                    {/* Tab Switcher */}
                    <AssetsTabSwitcher
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onFilterPress={() => setIsFilterVisible(true)}
                    />

                    {/* Asset / NFT List */}
                    {activeTab === 'assets' ? (
                        <View style={styles.assetList}>
                            {filteredTokens.map((token: any) => (
                                <AssetListItem
                                    key={`${token.chainId}-${token.address}`}
                                    asset={{
                                        ...token,
                                        id: token.address,
                                        logo: token.logoURI,
                                        change24h: parseFloat(token.priceChange24h || '0')
                                    }}
                                    onPress={() => handleAssetPress(token)}
                                />
                            ))}
                        </View>
                    ) : (
                        <NFTList nfts={filteredNFTs} isLoading={isLoadingNFTs} onNFTPress={handleNFTPress} />
                    )}
                </View>
            </ScrollView>

            {/* Filter Modal */}
            <WalletFilterSheet
                visible={isFilterVisible}
                onClose={() => setIsFilterVisible(false)}
                nfts={nfts}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    innerContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    assetList: {
        marginTop: 20,
        gap: 12,
    },
});
