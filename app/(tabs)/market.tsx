import { MarketComingSoon, type ComingSoonMarket } from '@/components/features/market/MarketComingSoon';
import { TokenListItem } from '@/components/sections/Market/TokenListItem';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useEnrichedMarkets } from '@/hooks/useEnrichedMarkets';
import { useTranslation } from '@/hooks/useLocalization';
import { MarketCategory } from '@/hooks/useMarketPairs';
import { api, MarketAsset, TokenItem } from '@/lib/mobile/api-client';
import { useMarketStore } from '@/store/marketStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 353; // From Figma design
const CONTENT_WIDTH = Math.min(SCREEN_WIDTH - 40, MAX_CONTENT_WIDTH); // 20px padding on each side

// Icons
const SearchIcon = require('../../assets/swap/search-01.svg');
const ArrowLeftIcon = require('../../assets/swap/arrow-left-02.svg');

// Line indicator for active tab
const imgLine327 = 'https://www.figma.com/api/mcp/asset/2040f48a-ef4a-465d-85f9-1bc8eb6c0987';
const imgLine340 = 'https://www.figma.com/api/mcp/asset/a1a2844d-92df-45f5-9b95-980536c19b61';

const subTabs: { id: string; label: string }[] = [
    { id: 'favourite', label: 'Favourite' },
    { id: 'explore', label: 'Explore' },
    { id: 'gainers', label: 'Gainers' },
    { id: 'losers', label: 'Losers' },
    { id: 'hot', label: 'Hot' },
    { id: 'spotlight', label: 'Spotlight' },
    { id: 'listing', label: 'Listing' },
];

const MarketListItemSkeleton = () => (
    <View style={skeletonStyles.container}>
        <View style={skeletonStyles.left}>
            <Skeleton width={32} height={32} borderRadius={16} />
            <View style={skeletonStyles.info}>
                <Skeleton width={80} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                <Skeleton width={120} height={12} borderRadius={4} />
            </View>
        </View>
        <View style={skeletonStyles.right}>
            <Skeleton width={70} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width={45} height={12} borderRadius={4} />
        </View>
    </View>
);

export default function MarketScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams<{ category?: string }>();

    const [marketType, setMarketType] = useState<any>('all');
    const isComingSoonTab = marketType !== 'all';
    const [sortBy, setSortBy] = useState<'volume' | 'performance' | 'price' | 'marketCap' | 'none'>('none');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'none'>('none');
    const [activeSubTab, setActiveSubTab] = useState<string>(
        (params.category as any) || 'explore'
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MarketAsset[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);

    const { favorites, toggleFavorite, isFavorite, getFavoriteTokens } = useMarketStore();

    const subTabs: { id: string; label: string }[] = useMemo(() => [
        { id: 'favourite', label: t('home.favourite') },
        { id: 'explore', label: 'Explore' },
        { id: 'spotlight', label: 'Spotlight' },
        { id: 'listing', label: 'Listing' },
        { id: 'gainers', label: t('home.gainers') },
        { id: 'losers', label: t('home.losers') },
    ], [t]);

    // Reset tab if category param changes
    useEffect(() => {
        if (params.category) {
            setActiveSubTab(params.category as any);
        }
    }, [params.category]);

    const {
        data: marketPairs,
        isLoading: isPairsLoading,
    } = useEnrichedMarkets({
        marketType: marketType,
        limit: 250,
        enabled: activeSubTab !== 'favourite'
    });

    // Fetch Spotlight/Listing tokens with price enrichment (matching web app)
    const { data: adminTokens = [], isLoading: isAdminLoading } = useQuery({
        queryKey: ['adminTokensEnriched', activeSubTab],
        queryFn: async () => {
            const res = await api.tokenSpotlight.get({
                category: activeSubTab === 'listing' ? 'listing' : 'spotlight',
                activeOnly: true
            });
            const tokensFromAPI = Array.isArray(res.tokens) ? res.tokens : [];
            const today = new Date().toISOString().split('T')[0];

            const active = tokensFromAPI
                .filter((t: any) => (!t.startDate || t.startDate <= today) && (!t.endDate || t.endDate >= today))
                .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0));

            // Enrich each token with price data from token-info API (like web app)
            const enriched = await Promise.all(active.map(async (st: any) => {
                // Try match from market pairs first
                const market = (marketPairs || []).find(
                    (et: any) =>
                        et.symbol?.toUpperCase() === st.symbol?.toUpperCase() ||
                        (st.address && et.address?.toLowerCase() === st.address?.toLowerCase())
                );
                if (market && market.price && parseFloat(String(market.price)) > 0) {
                    return { ...market, logoURI: market.logoURI || market.logo || st.logo || '' };
                }

                // Fetch from token-info API (exactly like web app)
                const chainId = st.chainId || 56;
                if (st.address) {
                    try {
                        const info = await api.tokenInfo.get(chainId, st.address);
                        const pool = info?.pool;
                        if (pool) {
                            return {
                                id: st.id || `${chainId}-${st.address}`,
                                symbol: st.symbol,
                                displaySymbol: st.symbol,
                                name: st.name || info?.token?.name || st.symbol,
                                address: st.address,
                                chainId,
                                logoURI: st.logo || info?.token?.logo || '',
                                logo: st.logo || info?.token?.logo || '',
                                price: pool.priceUsd ? String(pool.priceUsd) : '0',
                                priceUSD: pool.priceUsd ? String(pool.priceUsd) : '0',
                                priceChange24h: pool.priceChange24h || 0,
                                volume24h: pool.volume24h || 0,
                                marketCap: pool.marketCap || 0,
                                liquidity: pool.liquidity || 0,
                                marketType: 'spot',
                            };
                        }
                    } catch {}
                }

                // Fallback: no price data
                return {
                    id: st.id || st.symbol,
                    symbol: st.symbol,
                    displaySymbol: st.symbol,
                    name: st.name || st.symbol,
                    address: st.address || '',
                    chainId,
                    logoURI: st.logo || '',
                    logo: st.logo || '',
                    price: '0',
                    priceUSD: '0',
                    priceChange24h: 0,
                    volume24h: 0,
                    marketCap: 0,
                    marketType: 'spot',
                };
            }));

            return { tokens: enriched };
        },
        enabled: activeSubTab === 'spotlight' || activeSubTab === 'listing',
        staleTime: 30 * 1000,
    });

    // Staggered Prefetching (Phase 4: Optimization)
    const queryClient = useQueryClient();
    useEffect(() => {
        // Small delay to ensure the screen transition is BUTTERY smooth
        const timer = setTimeout(async () => {
            const otherType = marketType === 'spot' ? 'perp' : 'spot';
            queryClient.prefetchQuery({
                queryKey: ['enrichedMarkets', otherType, 250],
                queryFn: () => api.market.list({ marketType: otherType as any, limit: 250 })
            });
        }, 800);

        return () => clearTimeout(timer);
    }, [queryClient, marketType]);

    // Load favorites from store (no API call needed)
    const favoriteTokens = useMemo<MarketAsset[]>(() => {
        const saved = getFavoriteTokens();
        return saved.map(t => ({
            ...t,
            displaySymbol: t.symbol.toUpperCase(),
            price: t.priceUSD || '0',
            logoURI: t.logoURI || '',
            priceChange24h: t.priceChange24h || 0,
            volume24h: 0,
            marketCap: 0,
            marketType: 'spot',
            provider: 'onchain',
            rank: 999,
        } as any));
    }, [favorites]);
    const isFavLoading = false;

    // Backend Search Logic
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await api.tokens.list({
                    query: searchQuery,
                    limit: 20
                });

                const mappedResults: MarketAsset[] = response.tokens.map(t => {
                    const cleanSymbol = t.symbol.toUpperCase();
                    const displaySymbol = cleanSymbol;

                    return {
                        ...t,
                        id: t.id || `${t.chainId}-${t.address}`,
                        address: t.address,
                        symbol: t.symbol,
                        displaySymbol,
                        name: t.name,
                        chainId: t.chainId,
                        price: t.priceUSD || '0',
                        logoURI: t.logoURI || '',
                        priceChange24h: t.priceChange24h || 0,
                        volume24h: t.volume24h || 0,
                        marketCap: t.marketCap || 0,
                        marketType: 'spot',
                        provider: 'onchain',
                        rank: t.marketCapRank || 999
                    } as any;
                });

                setSearchResults(mappedResults);
            } catch (error) {
                console.error('[MarketScreen] Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    // Derive display data based on tab
    const displayData = useMemo<MarketAsset[]>(() => {
        let tokens: MarketAsset[] = activeSubTab === 'favourite' ? favoriteTokens : [...((marketPairs as any) || [])];

        // Spotlight/Listing tokens are already enriched with prices from the query
        if (activeSubTab === 'spotlight' || activeSubTab === 'listing') {
            const enrichedTokens = Array.isArray(adminTokens.tokens) ? adminTokens.tokens : [];
            return enrichedTokens as any;
        }

        // 1. Sort/Filter based on sub-tab
        if (activeSubTab !== 'favourite') {
            if (activeSubTab === 'gainers') {
                tokens = tokens
                    .filter(t => (t.priceChange24h ?? 0) > 0)
                    .sort((a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0));
            } else if (activeSubTab === 'losers') {
                tokens = tokens
                    .filter(t => (t.priceChange24h ?? 0) < 0)
                    .sort((a, b) => (a.priceChange24h ?? 0) - (b.priceChange24h ?? 0));
            } else if (activeSubTab === 'explore' || activeSubTab === 'hot') {
                tokens = tokens.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
            }
        }

        // 2. Apply Custom Sorting
        if (sortBy !== 'none' && sortDirection !== 'none') {
            tokens = [...tokens].sort((a, b) => {
                const multi = sortDirection === 'asc' ? 1 : -1;
                if (sortBy === 'volume') return ((a.volume24h || 0) - (b.volume24h || 0)) * multi;
                if (sortBy === 'marketCap') return ((a.marketCap || 0) - (b.marketCap || 0)) * multi;
                if (sortBy === 'performance') return ((a.priceChange24h || 0) - (b.priceChange24h || 0)) * multi;
                if (sortBy === 'price') return (parseFloat(String(a.price)) - parseFloat(String(b.price))) * multi;
                return 0;
            });
        }

        // 2. Apply Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const localResults = tokens.filter(t =>
                t.symbol.toLowerCase().includes(q) ||
                t.name.toLowerCase().includes(q)
            );

            const seen = new Set(localResults.map(t => `${t.chainId}-${t.address}`));
            const merged = [...localResults];

            searchResults.forEach(t => {
                const key = `${t.chainId}-${t.address}`;
                if (!seen.has(key)) {
                    merged.push(t);
                    seen.add(key);
                }
            });

            return merged;
        }

        // 3. TWC Priority Logic (Pin to 1st position)
        const isCoreDiscovery = activeSubTab === 'explore' || activeSubTab === 'favourite' || activeSubTab === 'gainers';
        if (isCoreDiscovery && searchQuery.trim() === '') {
            const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596'.toLowerCase();
            const twcIndex = tokens.findIndex(t =>
                (t.address && t.address.toLowerCase() === TWC_ADDRESS) ||
                t.symbol.toUpperCase() === 'TWC'
            );

            if (twcIndex > -1) {
                const [twcToken] = tokens.splice(twcIndex, 1);
                tokens.unshift(twcToken as any);
            }
        }

        return tokens;
    }, [activeSubTab, favoriteTokens, marketPairs, adminTokens, searchQuery, searchResults, sortBy, sortDirection, queryClient]);

    const isLoading = activeSubTab === 'favourite' 
        ? isFavLoading 
        : (activeSubTab === 'spotlight' || activeSubTab === 'listing')
            ? isAdminLoading
            : isPairsLoading;

    // Prefetch detail data early for ultra-fast navigation
    const handleTokenPress = useCallback(async (token: MarketAsset) => {
        setIsNavigating(true);

        const currentContext = marketType; // 'spot' or 'perp'
        const route = currentContext === 'perp'
            ? `/market/futures/${(token as any).displaySymbol || token.symbol}`
            : `/market/spot/${(token as any).displaySymbol || token.symbol}`;

        router.push({
            pathname: route as any,
            params: {
                address: (token as any).contractAddress || (token as any).baseToken?.address || token.address,
                chainId: token.chainId,
                symbol: (token as any).displaySymbol || token.symbol,
                provider: token.provider,
                name: token.name,
                marketType: currentContext
            }
        });

        // Small delay to let the active opacity effect finish and navigation begin
        setTimeout(() => setIsNavigating(false), 200);
    }, [marketType, router]);

    const renderItem = useCallback(({ item }: { item: MarketAsset }) => (
        <TokenListItem
            key={item.id || `${item.chainId}-${item.address}`}
            token={item as any}
            onPress={() => handleTokenPress(item)}
        />
    ), [handleTokenPress]);

    const handleSearchPress = () => {
        setIsSearchVisible(true);
    };

    const handleSearchBack = () => {
        setIsSearchVisible(false);
        setSearchQuery('');
    };

    // Search Screen
    if (isSearchVisible) {
        return (
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
                <CustomStatusBar />

                {/* Header with Search Bar */}
                <View style={[styles.headerContainer, { paddingTop: top }]}>
                    <View style={styles.searchBarContainer}>
                        {/* Search Bar */}
                        <View style={styles.searchBar}>
                            <TouchableOpacity onPress={handleSearchBack}>
                                <Image
                                    source={ArrowLeftIcon}
                                    style={styles.iconMedium}
                                    contentFit="contain"
                                />
                            </TouchableOpacity>
                            <View style={styles.searchInputContainer}>
                                <View style={styles.verticalDividerWrapper}>
                                    <Image
                                        source={{ uri: imgLine340 }}
                                        style={styles.verticalDivider}
                                        contentFit="contain"
                                    />
                                </View>
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search Coin Pairs"
                                    placeholderTextColor={colors.mutedText}
                                    autoFocus
                                    style={styles.textInput}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Top Tokens Label */}
                    {!isComingSoonTab && (
                        <View style={styles.topTokensLabelContainer}>
                            <Text style={styles.topTokensLabel}>Top Tokens</Text>
                        </View>
                    )}
                </View>

                {isComingSoonTab ? (
                    <MarketComingSoon
                        market={marketType as ComingSoonMarket}
                        onOpenSwap={() => setMarketType('all')}
                    />
                ) : (
                <FlatList
                    data={displayData}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id || `${item.chainId}-${item.address}`}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: bottom + 100 }
                    ]}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        isSearching && searchQuery.length > 0 && displayData.length === 0 ? (
                            <View style={{ width: '100%' }}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <MarketListItemSkeleton key={i} />
                                ))}
                            </View>
                        ) : null
                    }
                    ListFooterComponent={isSearching ? <MarketListItemSkeleton /> : null}
                    ListEmptyComponent={
                        !isSearching ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No tokens found</Text>
                            </View>
                        ) : null
                    }
                />
                )}

                {/* <LoadingOverlay
                    visible={isNavigating}
                    mode="glass"
                    onCancel={() => setIsNavigating(false)}
                /> */}
            </View>
        );
    }

    // Main Market Screen
    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header with Tabs */}
            <View style={[styles.headerContainer, { paddingTop: top }]}>
                {/* Spot/Perp Tabs */}
                <View style={styles.mainTabsContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabsLeft}
                    >
                        {/* Swap Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('all')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'all' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Swap
                            </Text>
                            {marketType === 'all' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>
                        {/* Spot Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('Spot')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'Spot' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Spot
                            </Text>
                            {marketType === 'Spot' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Perp Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('Perps')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'Perps' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Perp
                            </Text>
                            {marketType === 'Perps' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Stocks Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('Stocks')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'Stocks' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Stocks
                            </Text>
                            {marketType === 'Stocks' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Forex Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('Forex')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'Forex' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Forex
                            </Text>
                            {marketType === 'Forex' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Search Icon */}
                    <TouchableOpacity
                        onPress={handleSearchPress}
                        style={styles.iconMedium}
                    >
                        <Image
                            source={SearchIcon}
                            style={styles.iconFull}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                </View>

                {/* Sub-Tabs & Sort — only for Swap tab */}
                {!isComingSoonTab && (
                    <>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.subTabsContent}
                        >
                            {subTabs.map((tab) => {
                                const isActive = activeSubTab === tab.id;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        onPress={() => setActiveSubTab(tab.id)}
                                        style={[
                                            styles.subTabButton,
                                            { backgroundColor: isActive ? '#081f02' : colors.bgSemi }
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.subTabText,
                                                {
                                                    fontFamily: isActive ? 'Manrope-SemiBold' : 'Manrope-Medium',
                                                    color: isActive ? colors.primaryCTA : colors.bodyText
                                                }
                                            ]}
                                        >
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.sortingContainer}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (sortBy === 'volume') setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                    else { setSortBy('volume'); setSortDirection('desc'); }
                                }}
                                style={[styles.sortButton, sortBy === 'volume' && styles.activeSortButton]}
                            >
                                <Text style={[styles.sortText, sortBy === 'volume' && styles.activeSortText]}>Vol</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (sortBy === 'performance') setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                    else { setSortBy('performance'); setSortDirection('desc'); }
                                }}
                                style={[styles.sortButton, sortBy === 'performance' && styles.activeSortButton]}
                            >
                                <Text style={[styles.sortText, sortBy === 'performance' && styles.activeSortText]}>Change</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (sortBy === 'price') setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                    else { setSortBy('price'); setSortDirection('desc'); }
                                }}
                                style={[styles.sortButton, sortBy === 'price' && styles.activeSortButton]}
                            >
                                <Text style={[styles.sortText, sortBy === 'price' && styles.activeSortText]}>Price</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    if (sortBy === 'marketCap') setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
                                    else { setSortBy('marketCap'); setSortDirection('desc'); }
                                }}
                                style={[styles.sortButton, sortBy === 'marketCap' && styles.activeSortButton]}
                            >
                                <Text style={[styles.sortText, sortBy === 'marketCap' && styles.activeSortText]}>MCap</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>

            {/* Token List or Coming Soon */}
            {isComingSoonTab ? (
                <MarketComingSoon
                    market={marketType as ComingSoonMarket}
                    onOpenSwap={() => setMarketType('all')}
                />
            ) : (
                <FlatList
                    data={displayData}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id || `${item.chainId}-${item.address}`}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: bottom + 100 }
                    ]}
                    initialNumToRender={12}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={Platform.OS === 'android'}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        isLoading ? (
                            <View style={{ width: '100%' }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                    <MarketListItemSkeleton key={i} />
                                ))}
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        !isLoading ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No tokens found</Text>
                            </View>
                        ) : null
                    }
                />
            )}

            <LoadingOverlay
                visible={isNavigating}
                mode="glass"
                onCancel={() => setIsNavigating(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    headerContainer: {
        backgroundColor: colors.bg,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
    },
    searchBarContainer: {
        paddingHorizontal: 20,
        paddingVertical: 0,
    },
    searchBar: {
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 20,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconMedium: {
        width: 24,
        height: 24,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verticalDividerWrapper: {
        width: 16,
        height: 1,
    },
    verticalDivider: {
        width: '100%',
        height: 1,
        transform: [{ rotate: '90deg' }],
    },
    textInput: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        padding: 0,
    },
    topTokensLabelContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    topTokensLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 20,
        color: colors.mutedText,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        // paddingHorizontal: Math.max(20, (SCREEN_WIDTH - CONTENT_WIDTH) / 2),
        paddingTop: 0,
        alignItems: 'center',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    mainTabsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 0,
    },
    tabsLeft: {
        flexDirection: 'row',
        gap: 16,
    },
    tabButton: {
        flexDirection: 'column',
        gap: 10,
        alignItems: 'center',
        paddingVertical: 0,
    },
    tabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        lineHeight: 20,
    },
    activeTabIndicatorWrapper: {
        height: 1.5,
        width: '100%',
    },
    activeTabIndicator: {
        width: '100%',
        height: 1.5,
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
    subTabsContent: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 8,
    },
    subTabButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 100,
    },
    subTabText: {
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.012,
    },
    sortingContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 8,
        gap: 8,
    },
    sortButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    activeSortButton: {
        borderColor: colors.primaryCTA + '50',
        backgroundColor: colors.primaryCTA + '10',
    },
    sortText: {
        fontSize: 10,
        fontFamily: 'Manrope-Medium',
        color: colors.bodyText,
    },
    activeSortText: {
        color: colors.primaryCTA,
    },
});

const skeletonStyles = StyleSheet.create({
    container: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    info: {
        flex: 1,
    },
    right: {
        alignItems: 'flex-end',
    }
});
