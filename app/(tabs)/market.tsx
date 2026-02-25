import { TokenListItem } from '@/components/sections/Market/TokenListItem';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useEnrichedMarkets } from '@/hooks/useEnrichedMarkets';
import { useTranslation } from '@/hooks/useLocalization';
import { MarketCategory } from '@/hooks/useMarketPairs';
import { apiClient, EnrichedMarket } from '@/services/apiClient';
import { useMarketStore } from '@/store/marketStore';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const subTabs: { id: MarketCategory | 'favourite'; label: string }[] = [
    { id: 'favourite', label: 'Favourite' },
    { id: 'hot', label: 'Top' },
    { id: 'new', label: 'New' },
    { id: 'gainers', label: 'Gainers' },
    { id: 'losers', label: 'Losers' },
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

    const [marketType, setMarketType] = useState<'spot' | 'perp'>('spot');
    const [activeSubTab, setActiveSubTab] = useState<string>(
        (params.category as any) || 'hot'
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<EnrichedMarket[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);

    const { favorites, toggleFavorite, isFavorite } = useMarketStore();

    const subTabs: { id: MarketCategory | 'favourite'; label: string }[] = useMemo(() => [
        { id: 'favourite', label: t('home.favourite') },
        { id: 'hot', label: t('home.top') },
        { id: 'new', label: t('home.new') },
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
        marketType: marketType === 'perp' ? 'perp' : 'spot',
        limit: 250,
        enabled: activeSubTab !== 'favourite'
    });

    // Staggered Prefetching (Phase 4: Optimization)
    const queryClient = useQueryClient();
    useEffect(() => {
        // Small delay to ensure the screen transition is BUTTERY smooth
        const timer = setTimeout(async () => {
            const otherType = marketType === 'spot' ? 'perp' : 'spot';
            queryClient.prefetchQuery({
                queryKey: ['enrichedMarkets', otherType, 250],
                queryFn: () => apiClient.getEnrichedMarkets({ marketType: otherType, limit: 250 })
            });
        }, 800);

        return () => clearTimeout(timer);
    }, [queryClient, marketType]);

    // Fetch favorites
    const [favoriteTokens, setFavoriteTokens] = useState<EnrichedMarket[]>([]);
    const [isFavLoading, setIsFavLoading] = useState(false);

    useEffect(() => {
        if (activeSubTab !== 'favourite') return;

        const loadFavs = async () => {
            if (favorites.length === 0) {
                setFavoriteTokens([]);
                return;
            }

            setIsFavLoading(true);
            try {
                const promises = favorites.map(async (id) => {
                    const [chainId, address] = id.split('-');
                    try {
                        const response = await apiClient.getTokens({
                            address,
                            chains: [parseInt(chainId)],
                            limit: 1
                        });
                        return response.tokens[0];
                    } catch (e) {
                        return null;
                    }
                });

                const results = await Promise.all(promises);
                const validResults = results.filter((t): t is any => !!t && !!t.address);

                const mappedFavs: EnrichedMarket[] = validResults.map(t => {
                    const cleanSymbol = t.symbol.toUpperCase();
                    const displaySymbol = (cleanSymbol.includes('/') || cleanSymbol.includes('-')) ? cleanSymbol : `${cleanSymbol}-USD`;

                    return {
                        ...t,
                        id: `${t.chainId}-${t.address}`,
                        address: t.address,
                        symbol: t.symbol,
                        displaySymbol,
                        name: t.name,
                        chainId: t.chainId,
                        decimals: t.decimals || 18,
                        priceUSD: t.priceUSD || '0',
                        price: t.priceUSD || '0',
                        logoURI: t.logoURI || '',
                        logo: t.logoURI || t.logo || '',
                        priceChange24h: t.priceChange24h ? parseFloat(String(t.priceChange24h)) : 0,
                        volume24h: typeof t.volume24h === 'number' ? t.volume24h : parseFloat(String(t.volume24h || '0')),
                        marketCap: typeof t.marketCap === 'number' ? t.marketCap : parseFloat(String(t.marketCap || '0')),
                        marketType: 'spot',
                        provider: 'onchain',
                        verified: t.verified || false
                    };
                });

                setFavoriteTokens(mappedFavs);
            } catch (error) {
                console.error('[MarketScreen] Error loading favorites:', error);
            } finally {
                setIsFavLoading(false);
            }
        };

        loadFavs();
    }, [activeSubTab, favorites]);

    // Backend Search Logic
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await apiClient.getTokens({
                    query: searchQuery,
                    limit: 20
                });

                const mappedResults: EnrichedMarket[] = response.tokens.map(t => {
                    const cleanSymbol = t.symbol.toUpperCase();
                    const displaySymbol = (cleanSymbol.includes('/') || cleanSymbol.includes('-')) ? cleanSymbol : `${cleanSymbol}-USD`;

                    return {
                        ...t,
                        id: `${t.chainId}-${t.address}`,
                        address: t.address,
                        symbol: t.symbol,
                        displaySymbol,
                        name: t.name,
                        chainId: t.chainId,
                        decimals: t.decimals || 18,
                        priceUSD: t.priceUSD || '0',
                        price: t.priceUSD || '0',
                        logoURI: t.logoURI || '',
                        logo: t.logoURI || t.logo || '',
                        priceChange24h: t.priceChange24h ? parseFloat(String(t.priceChange24h)) : 0,
                        volume24h: typeof t.volume24h === 'number' ? t.volume24h : parseFloat(String(t.volume24h || '0')),
                        marketCap: typeof t.marketCap === 'number' ? t.marketCap : parseFloat(String(t.marketCap || '0')),
                        marketType: 'spot',
                        provider: 'onchain',
                        verified: t.verified || false
                    };
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
    const displayData = useMemo<EnrichedMarket[]>(() => {
        let tokens: EnrichedMarket[] = activeSubTab === 'favourite' ? favoriteTokens : [...(marketPairs || [])];

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
            } else if (activeSubTab === 'new') {
                // Sort by rank/market cap for 'new' (lowest rank often means newer or smaller caps)
                tokens = tokens.sort((a, b) => (a.marketCapRank ?? 999999) - (b.marketCapRank ?? 999999));
            } else if (activeSubTab === 'hot') {
                // Default API sorting is usually by volume/hot
                tokens = tokens.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
            }
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

        // 3. TWC Priority Logic (Pin to 2nd position in Top/Gainers)
        if (activeSubTab === 'hot' || activeSubTab === 'gainers') {
            const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596'.toLowerCase();
            const twcIndex = tokens.findIndex(t =>
                (t.address && t.address.toLowerCase() === TWC_ADDRESS) ||
                t.symbol.toUpperCase() === 'TWC'
            );

            if (twcIndex > -1) {
                const [twcToken] = tokens.splice(twcIndex, 1);
                // Insert at index 1 (2nd position) if list has enough items
                if (tokens.length >= 1) {
                    tokens.splice(1, 0, twcToken as EnrichedMarket);
                } else {
                    tokens.unshift(twcToken as EnrichedMarket);
                }
            }
        }

        return tokens;
    }, [activeSubTab, favoriteTokens, marketPairs, searchQuery, searchResults]);

    const isLoading = activeSubTab === 'favourite' ? isFavLoading : isPairsLoading;

    const handleTokenPress = async (token: EnrichedMarket) => {
        setIsNavigating(true);

        // Bridge: Save full token data for instant UI hydration on detail page
        // setSelectedMarketToken(token);

        const symbolParam = (token.displaySymbol || token.symbol).toLowerCase();
        const currentContext = marketType; // 'spot' or 'perp'

        const route = currentContext === 'perp'
            ? `/market/futures/${token.displaySymbol || token.symbol}`
            : `/market/spot/${token.displaySymbol || token.symbol}`;

        // Prefetch detail data with unified dispatcher params
        try {
            // await queryClient.prefetchQuery({
            //     queryKey: ['enrichedMarketDetail', token.symbol, token.address, currentContext],
            //     queryFn: () => apiClient.getEnrichedMarketDetail(token.displaySymbol || token.symbol, {
            //         address: token.contractAddress || token.baseToken?.address,
            //         chainId: token.chainId,
            //         marketType: currentContext,
            //         provider: token.provider
            //     })
            // });

            router.push({
                pathname: route as any,
                params: {
                    address: token.contractAddress || token.baseToken?.address,
                    chainId: token.chainId,
                    symbol: token.displaySymbol || token.symbol,
                    provider: token.provider,
                    name: token.name,
                    marketType: currentContext
                }
            });
        } catch (error) {
            console.error('[MarketScreen] Prefetch error:', error);
            // Navigate anyway, the page will handle its own loading from initialData/Zustand
            router.push({
                pathname: route as any,
                params: {
                    symbol: token.displaySymbol || token.symbol,
                    address: token.address,
                    chainId: token.chainId,
                    provider: token.provider,
                    marketType: currentContext
                }
            });
        } finally {
            // Give time for navigation to transition
            setTimeout(() => setIsNavigating(false), 300);
        }
    };

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
                    <View style={styles.topTokensLabelContainer}>
                        <Text style={styles.topTokensLabel}>Top Tokens</Text>
                    </View>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: bottom + 100 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ width: "100%", maxWidth: '100%' }}>
                        {isSearching && searchQuery.length > 0 && displayData.length === 0 ? (
                            <View style={{ width: '100%' }}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <MarketListItemSkeleton key={i} />
                                ))}
                            </View>
                        ) : (
                            <>
                                {displayData.map((token: EnrichedMarket) => (
                                    <TokenListItem
                                        key={token.id || `${token.chainId}-${token.address}`}
                                        token={token as any}
                                        onPress={() => handleTokenPress(token)}
                                    />
                                ))}
                                {isSearching && <MarketListItemSkeleton />}
                                {!isSearching && displayData.length === 0 && (
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyText}>No tokens found</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </ScrollView>

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
                    <View style={styles.tabsLeft}>
                        {/* Spot Tab */}
                        <TouchableOpacity
                            onPress={() => setMarketType('spot')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'spot' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Spot
                            </Text>
                            {marketType === 'spot' && (
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
                            onPress={() => setMarketType('perp')}
                            style={styles.tabButton}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: marketType === 'perp' ? colors.primaryCTA : colors.mutedText }
                                ]}
                            >
                                Perp
                            </Text>
                            {marketType === 'perp' && (
                                <View style={styles.activeTabIndicatorWrapper}>
                                    <Image
                                        source={{ uri: imgLine327 }}
                                        style={styles.activeTabIndicator}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

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

                {/* Sub-Tabs */}
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
                                onPress={() => {
                                    // Let the ripple animation play for a split second
                                    setActiveSubTab(tab.id);
                                }}
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
            </View>

            {/* Token List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: bottom + 100 } // Extra padding for tab bar
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ width: "100%", maxWidth: '100%' }}>
                    {isLoading ? (
                        <View style={{ width: '100%' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <MarketListItemSkeleton key={i} />
                            ))}
                        </View>
                    ) : (
                        displayData.map((token: EnrichedMarket) => (
                            <TokenListItem
                                key={token.id || `${token.chainId}-${token.address}`}
                                token={token as any}
                                onPress={() => handleTokenPress(token)}
                            />
                        ))
                    )}
                    {!isLoading && displayData.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No tokens found</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

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
