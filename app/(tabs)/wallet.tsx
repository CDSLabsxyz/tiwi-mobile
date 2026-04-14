import {
    AddTokenModal,
    AssetListItem,
    AssetsTabSwitcher,
    ClaimableRewardsCard,
    NFTList,
    QuickActions,
    TotalBalanceCard,
    WalletFilterSheet,
    type WalletTabKey,
} from '@/components/sections/Wallet';
import { useCustomTokenStore, type CustomToken } from '@/store/customTokenStore';
import { fetchEvmTokenBalance, fetchSolanaTokenBalance } from '@/services/customTokenBalance';
import { api } from '@/lib/mobile/api-client';
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
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const DeleteIcon = require('@/assets/settings/delete-02.svg');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FALLBACK_NAMES: Record<number, string> = {
    1: 'Ethereum', 56: 'BNB Chain', 137: 'Polygon', 42161: 'Arbitrum',
    8453: 'Base', 10: 'Optimism', 43114: 'Avalanche', 59144: 'Linea',
    250: 'Fantom', 42220: 'Celo', 100: 'Gnosis', 7565164: 'Solana',
    1100: 'TON', 728126428: 'TRON',
};

const FALLBACK_LOGOS: Record<number, string> = {
    1: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    56: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
    137: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    42161: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    8453: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    10: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
    43114: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
    59144: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png',
    250: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fantom/info/logo.png',
    42220: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png',
    100: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xdai/info/logo.png',
    7565164: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    1100: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ton/info/logo.png',
    728126428: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png',
};

export default function WalletScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams<{ tab?: string }>();
    const queryClient = useQueryClient();

    // Store data (connected wallets)
    const { address, walletGroups = [], activeGroupId } = useWalletStore();
    const walletKey = activeGroupId || address || 'default';

    // TanStack Query for Balances
    const {
        data: balanceData,
        isLoading: isLoadingBalances,
        isRefetching: isRefetchingBalances,
        isFetching: isFetchingBalances,
        isPlaceholderData: isBalancePlaceholder,
    } = useWalletBalances();

    const tokens = balanceData?.tokens || [];
    const totalNetWorthUsd = balanceData?.totalNetWorthUsd || '0.00';

    // "Updating…" signal for the balance card: true only on fresh import
    // (no data yet) or on wallet switch (showing previous wallet's data via
    // keepPreviousData). Routine background refetches do NOT set this, so
    // the UI doesn't flicker every minute.
    const isWalletBalanceUpdating =
        isFetchingBalances && (isBalancePlaceholder || !balanceData);

    // Subscribe to filter store values for reactivity
    const sortBy = useFilterStore((state) => state.sortBy);
    const tokenCategories = useFilterStore((state) => state.tokenCategories);
    const chains = useFilterStore((state) => state.chains);

    // State
    const [activeTab, setActiveTab] = useState<WalletTabKey>((params.tab as WalletTabKey) || 'assets');
    const isBalanceHidden = useWalletStore((state) => state.isBalanceHidden);
    const toggleBalanceVisibility = useWalletStore((state) => state.toggleBalanceVisibility);

    const [isFilterVisible, setIsFilterVisible] = useState(false);
    const [isAddTokenVisible, setIsAddTokenVisible] = useState(false);
    const [nfts, setNfts] = useState<NFTItem[]>([]);
    const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);

    // Custom tokens scoped to this wallet
    const tokensByWallet = useCustomTokenStore(s => s.tokensByWallet);
    const removeCustomToken = useCustomTokenStore(s => s.removeToken);
    const updateTokenBalance = useCustomTokenStore(s => s.updateTokenBalance);
    const customTokens = useMemo(() => tokensByWallet[walletKey] || [], [tokensByWallet, walletKey]);
    const [tokenToRemove, setTokenToRemove] = useState<CustomToken | null>(null);

    // Auto-sync custom token balances — runs on mount + whenever wallet refreshes.
    // Directly fetches each custom token's balance from the chain so low-value tokens
    // (which the main balance API filters out at the $5 threshold) still update correctly.
    useEffect(() => {
        if (!customTokens.length) return;

        const activeGroup = walletGroups.find(g => g.id === activeGroupId);
        if (!activeGroup) return;

        let cancelled = false;

        const syncCustomBalances = async () => {
            for (const ct of customTokens) {
                // 1. First check if main balance API already has it (fast path)
                const match = tokens.find((t: any) =>
                    t.address?.toLowerCase() === ct.address.toLowerCase() && Number(t.chainId) === ct.chainId
                );
                if (match) {
                    const newBal = match.balanceFormatted || '0';
                    const newPrice = match.priceUSD || ct.priceUSD;
                    const newUsd = match.usdValue || (parseFloat(newBal) * parseFloat(newPrice || '0')).toFixed(2);
                    if (newBal !== ct.balanceFormatted || newUsd !== ct.usdValue || newPrice !== ct.priceUSD) {
                        updateTokenBalance(walletKey, ct.address, ct.chainId, {
                            balanceFormatted: newBal,
                            usdValue: newUsd,
                            priceUSD: newPrice,
                        });
                    }
                    continue;
                }

                // 2. Not in main API — fetch directly from chain
                let freshBal: string | null = null;
                if (ct.chainId === 7565164) {
                    const solAddr = activeGroup.addresses?.SOLANA;
                    if (solAddr) freshBal = await fetchSolanaTokenBalance(ct.address, solAddr);
                } else {
                    const evmAddr = activeGroup.addresses?.EVM;
                    if (evmAddr) freshBal = await fetchEvmTokenBalance(ct.chainId, ct.address, evmAddr);
                }

                if (cancelled || freshBal === null) continue;

                // 3. Fetch fresh price too (token may have changed price)
                let freshPrice = ct.priceUSD || '0';
                try {
                    const info = await api.tokenInfo.get(ct.chainId, ct.address);
                    if (info?.pool?.priceUsd) freshPrice = String(info.pool.priceUsd);
                } catch {}

                if (cancelled) continue;

                const freshUsd = (parseFloat(freshBal) * parseFloat(freshPrice)).toFixed(2);
                if (freshBal !== ct.balanceFormatted || freshUsd !== ct.usdValue || freshPrice !== ct.priceUSD) {
                    updateTokenBalance(walletKey, ct.address, ct.chainId, {
                        balanceFormatted: freshBal,
                        usdValue: freshUsd,
                        priceUSD: freshPrice,
                    });
                }
            }
        };

        syncCustomBalances();

        return () => { cancelled = true; };
    }, [tokens, customTokens.length, walletKey, walletGroups, activeGroupId, updateTokenBalance]);

    const handleRemoveCustomToken = (ct: CustomToken) => {
        setTokenToRemove(ct);
    };

    const confirmRemoveToken = () => {
        if (tokenToRemove) {
            removeCustomToken(walletKey, tokenToRemove.address, tokenToRemove.chainId);
            setTokenToRemove(null);
        }
    };

    // Filtered items
    const filteredTokens = useMemo(() => {
        return applyFilters(tokens, { sortBy, tokenCategories, chains });
    }, [tokens, sortBy, tokenCategories, chains]);

    // Custom tokens that are NOT already in the balance list (zero balance / not fetched)
    const customTokensWithoutBalance = useMemo(() => {
        return customTokens.filter(ct =>
            !tokens.some(t =>
                t.address?.toLowerCase() === ct.address.toLowerCase() && Number(t.chainId) === ct.chainId
            )
        );
    }, [customTokens, tokens]);

    const filteredNFTs = useMemo(() => {
        return applyFilters(nfts, { sortBy, tokenCategories, chains });
    }, [nfts, sortBy, tokenCategories, chains]);

    // UI Handlers
    const handleToggleVisibility = () => toggleBalanceVisibility();
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
                change24h: asset.priceChange24h,
                address: asset.address,
                decimals: asset.decimals
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
        if (ecos.includes('solana')) ids.push(7565164);
        return ids;
    }, [supportedEcosystems]);

    // Pre-warm React Query cache for tokens and chains
    const { data: chainsData } = useChains(supportedEcosystems[0] as any);
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
                        isBalanceVisible={!isBalanceHidden}
                        onToggleVisibility={handleToggleVisibility}
                        onTodayPress={handleTodayPress}
                        isUpdating={isWalletBalanceUpdating}
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
                        onAddTokenPress={() => setIsAddTokenVisible(true)}
                    />

                    {/* Asset / NFT List */}
                    {activeTab === 'assets' ? (
                        <View style={styles.assetList}>
                            {filteredTokens.map((token: any) => {
                                // Find the chain logo and name from the chains data with fallback
                                const tokenChain = (chainsData || []).find(c => Number(c.id) === Number(token.chainId));

                                const chainName = tokenChain?.name || FALLBACK_NAMES[token.chainId] || 'Unknown';

                                // Priority: dynamic logo > fallback require > token.logoURI (fallback to token's own logo if somehow nothing else)
                                const chainLogo = tokenChain?.logoURI || (tokenChain as any)?.logo || FALLBACK_LOGOS[token.chainId];

                                return (
                                    <AssetListItem
                                        key={`${token.chainId}-${token.address}`}
                                        asset={{
                                            ...token,
                                            id: token.address,
                                            logo: token.logoURI,
                                            change24h: parseFloat(token.priceChange24h || '0'),
                                            chainLogo: chainLogo,
                                            chainName: chainName
                                        }}
                                        onPress={() => handleAssetPress(token)}
                                    />
                                );
                            })}

                            {/* Custom Added Tokens (no balance) */}
                            {customTokensWithoutBalance.length > 0 && (
                                <>
                                    <View style={styles.addedTokensDivider}>
                                        <View style={styles.dividerLine} />
                                        <Text style={styles.addedTokensLabel}>Added Tokens</Text>
                                        <View style={styles.dividerLine} />
                                    </View>
                                    <TouchableOpacity
                                        style={styles.manageTokensBtn}
                                        onPress={() => setIsAddTokenVisible(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.manageTokensText}>+ Manage Tokens</Text>
                                    </TouchableOpacity>
                                    {customTokensWithoutBalance.map(ct => {
                                        const chainName = FALLBACK_NAMES[ct.chainId] || 'Unknown';
                                        const chainLogo = FALLBACK_LOGOS[ct.chainId];
                                        return (
                                            <View key={`custom-${ct.chainId}-${ct.address}`} style={{ position: 'relative', paddingTop: 14 }}>
                                                <AssetListItem
                                                    asset={{
                                                        symbol: ct.symbol,
                                                        name: ct.name,
                                                        address: ct.address,
                                                        chainId: ct.chainId,
                                                        id: ct.address,
                                                        logo: ct.logoURI || '',
                                                        balance: '0',
                                                        decimals: ct.decimals,
                                                        balanceFormatted: ct.balanceFormatted || '0',
                                                        usdValue: ct.usdValue || '0',
                                                        priceUSD: ct.priceUSD || '0',
                                                        change24h: 0,
                                                        chainLogo,
                                                        chainName,
                                                    }}
                                                    onPress={() => handleAssetPress({
                                                        symbol: ct.symbol,
                                                        name: ct.name,
                                                        address: ct.address,
                                                        chainId: ct.chainId,
                                                        logoURI: ct.logoURI,
                                                        balanceFormatted: ct.balanceFormatted || '0',
                                                        usdValue: ct.usdValue || '0',
                                                        priceUSD: ct.priceUSD || '0',
                                                        priceChange24h: 0,
                                                        decimals: ct.decimals,
                                                    })}
                                                />
                                                <TouchableOpacity
                                                    onPress={() => handleRemoveCustomToken(ct)}
                                                    style={styles.removeTokenBtn}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <ExpoImage source={DeleteIcon} style={styles.removeTokenIcon} contentFit="contain" tintColor="#FF3B30" />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </>
                            )}
                        </View>
                    ) : (
                        <NFTList nfts={filteredNFTs} isLoading={isLoadingNFTs} onNFTPress={handleNFTPress} />
                    )}
                </View>
            </ScrollView>

            {/* Add Token Modal */}
            <AddTokenModal
                visible={isAddTokenVisible}
                onClose={() => setIsAddTokenVisible(false)}
            />

            {/* Remove Token Confirmation Modal */}
            <Modal
                visible={!!tokenToRemove}
                transparent
                animationType="fade"
                onRequestClose={() => setTokenToRemove(null)}
            >
                <View style={styles.removeModalOverlay}>
                    <View style={styles.removeModalContent}>
                        <View style={styles.removeIconCircle}>
                            <ExpoImage source={DeleteIcon} style={{ width: 24, height: 24 }} contentFit="contain" tintColor="#FF3B30" />
                        </View>
                        <Text style={styles.removeModalTitle}>Remove Token</Text>
                        <Text style={styles.removeModalMessage}>
                            Remove {tokenToRemove?.symbol} from your added tokens?
                        </Text>
                        <View style={styles.removeModalButtons}>
                            <TouchableOpacity
                                style={[styles.removeModalBtn, styles.removeModalCancel]}
                                onPress={() => setTokenToRemove(null)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.removeModalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.removeModalBtn, styles.removeModalConfirm]}
                                onPress={confirmRemoveToken}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.removeModalConfirmText}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
    addedTokensDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        marginBottom: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.bgStroke,
    },
    addedTokensLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.mutedText,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    manageTokensBtn: {
        alignSelf: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginTop: 4,
        marginBottom: 4,
    },
    manageTokensText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 13,
        color: colors.primaryCTA,
    },
    removeTokenBtn: {
        position: 'absolute',
        top: 6,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 59, 48, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    removeTokenIcon: {
        width: 13,
        height: 13,
    },
    // Remove token confirmation modal
    removeModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    removeModalContent: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 20,
        padding: 28,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        alignItems: 'center',
    },
    removeIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 59, 48, 0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 59, 48, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    removeModalTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: colors.titleText,
        marginBottom: 8,
        textAlign: 'center',
    },
    removeModalMessage: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.bodyText,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
    },
    removeModalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    removeModalBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeModalCancel: {
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    removeModalCancelText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.bodyText,
    },
    removeModalConfirm: {
        backgroundColor: '#FF3B30',
    },
    removeModalConfirmText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: '#FFFFFF',
    },
});
