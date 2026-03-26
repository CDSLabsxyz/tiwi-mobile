import { TokenListItem } from '@/components/sections/Market/TokenListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useEnrichedMarkets } from '@/hooks/useEnrichedMarkets';
import { useTranslation } from '@/hooks/useLocalization';
import { api, MarketAsset, TokenItem } from '@/lib/mobile/api-client';
import { useMarketStore } from '@/store/marketStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Line indicator for active tab
const imgLine327 = 'https://www.figma.com/api/mcp/asset/2040f48a-ef4a-465d-85f9-1bc8eb6c0987';

interface MarketSectionProps {
    isLoading?: boolean;
}

/**
 * Market Section for Home Screen
 * Displays a curated list of top tokens with tabbed filtering.
 */
export const MarketSection: React.FC<MarketSectionProps> = ({
    isLoading: initialLoading = false,
}) => {
    const router = useRouter();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<string>('hot');
    const { favorites, isFavorite } = useMarketStore();

    const tabs: { id: string; label: string }[] = useMemo(() => [
        { id: 'favourite', label: t('home.favourite') },
        { id: 'explore', label: 'Explore' },
        { id: 'gainers', label: t('home.gainers') },
        { id: 'losers', label: t('home.losers') },
        { id: 'hot', label: 'Hot' },
        { id: 'spotlight', label: 'Spotlight' },
        { id: 'listing', label: 'Listing' },
    ], [t]);

    // 1. Fetch market data using unified hook
    const {
        data: marketPairs,
        isLoading: isPairsLoading,
    } = useEnrichedMarkets({
        marketType: 'all',
        limit: 50,
        enabled: activeTab !== 'favourite'
    });

    // 2. Fetch Spotlight/Listing tokens (Mirroring Web)
    const { data: adminTokens = [], isLoading: isAdminLoading } = useQuery({
        queryKey: ['adminTokens', activeTab],
        queryFn: () => api.tokenSpotlight.get({ 
            category: activeTab === 'listing' ? 'listing' : 'spotlight',
            activeOnly: true 
        }),
        enabled: activeTab === 'spotlight' || activeTab === 'listing',
    });

    // 3. Fetch favorites
    const [favoriteTokens, setFavoriteTokens] = useState<MarketAsset[]>([]);
    const [isFavLoading, setIsFavLoading] = useState(false);

    useEffect(() => {
        if (activeTab !== 'favourite') return;

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
                        const response = await api.tokens.list({
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
                const validResults = results.filter((t): t is TokenItem => !!t && !!t.address);

                const mappedFavs: MarketAsset[] = validResults.map(t => {
                    const cleanSymbol = t.symbol.toUpperCase();
                    const displaySymbol = (cleanSymbol.includes('/') || cleanSymbol.includes('-')) ? cleanSymbol : `${cleanSymbol}-USD`;

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
                    } as any;
                });

                setFavoriteTokens(mappedFavs);
            } catch (error) {
                console.error('[MarketSection] Error loading favorites:', error);
            } finally {
                setIsFavLoading(false);
            }
        };

        loadFavs();
    }, [activeTab, favorites]);

    // 4. Derive display data
    const displayData = useMemo<MarketAsset[]>(() => {
        let tokens: MarketAsset[] = activeTab === 'favourite' ? favoriteTokens : [...((marketPairs as any) || [])];

        // Process Admin tokens (Spotlight/Listing) from Database
        if (activeTab === 'spotlight' || activeTab === 'listing') {
            const tokensFromAPI = Array.isArray(adminTokens.tokens) ? adminTokens.tokens : [];
            const today = new Date().toISOString().split('T')[0];

            // 1. Filter by direct date logic (exactly like Web app)
            const active = tokensFromAPI.filter((t: any) => 
                (!t.startDate || t.startDate <= today) && 
                (!t.endDate || t.endDate >= today)
            ).sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0));

            return active.map((st: any) => {
                const enriched = (marketPairs || []).find(
                    (et: any) => 
                        et.symbol.toUpperCase() === st.symbol.toUpperCase() || 
                        (st.address && et.address?.toLowerCase() === st.address.toLowerCase())
                );
                
                if (enriched) return enriched;
                
                return {
                    id: st.id || st.symbol,
                    symbol: st.symbol,
                    name: st.name || st.symbol,
                    address: st.address || "",
                    chainId: st.chainId || 56,
                    logoURI: st.logo || "",
                    price: '0',
                    priceChange24h: 0,
                    volume24h: 0,
                    marketCap: 0,
                    marketType: 'spot'
                } as any;
            }).slice(0, 5);
        }

        if (activeTab !== 'favourite') {
            if (activeTab === 'gainers') {
                tokens = tokens
                    .filter(t => (t.priceChange24h ?? 0) > 0)
                    .sort((a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0));
            } else if (activeTab === 'losers') {
                tokens = tokens
                    .filter(t => (t.priceChange24h ?? 0) < 0)
                    .sort((a, b) => (a.priceChange24h ?? 0) - (b.priceChange24h ?? 0));
            } else if (activeTab === 'explore' || activeTab === 'hot') {
                tokens = tokens.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
            } else if (activeTab === 'explore') {
                // For Explore on home, we just show top tokens by volume as well or default order
                tokens = tokens.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
            }
        }

        return tokens.slice(0, 5);
    }, [activeTab, favoriteTokens, marketPairs, adminTokens]);

    const isLoading = activeTab === 'favourite' 
        ? isFavLoading 
        : (activeTab === 'spotlight' || activeTab === 'listing')
            ? isAdminLoading
            : isPairsLoading;

    if (isLoading && displayData.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <Skeleton width={80} height={20} borderRadius={4} />
                <View style={styles.loadingList}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} width="100%" height={60} borderRadius={8} />
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('home.market')}</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContainer}
                >
                    {tabs.map((tab) => {
                        const isActive = tab.id === activeTab;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                style={styles.tabButton}
                            >
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        { color: isActive ? colors.primaryCTA : colors.mutedText }
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                                {isActive && (
                                    <View style={styles.activeIndicatorWrapper}>
                                        <Image
                                            source={{ uri: imgLine327 }}
                                            style={styles.activeIndicator}
                                            contentFit="contain"
                                        />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={styles.listContainer}>
                {displayData.map((token) => (
                    <TokenListItem
                        key={`${token.chainId}-${token.address}-${token.symbol}`}
                        token={{
                            ...token,
                            priceUSD: token.price?.toString(),
                            marketCapRank: (token as any).rank
                        }}
                        onPress={() => {
                            router.push({
                                pathname: `/market/spot/${token.symbol.toLowerCase()}` as any,
                                params: {
                                    address: token.address,
                                    chainId: token.chainId,
                                    symbol: token.symbol
                                }
                            });
                        }}
                    />
                ))}

                {displayData.length === 0 && !isLoading && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No tokens found</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => router.push(`/market?category=${activeTab}` as any)}
                >
                    <Text style={styles.viewAllText}>{t('home.view_all')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginTop: 8,
    },
    loadingContainer: {
        width: '100%',
        gap: 16,
    },
    loadingList: {
        gap: 12,
    },
    header: {
        width: '100%',
        marginBottom: 12,
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: colors.titleText,
        marginBottom: 16,
    },
    tabsScroll: {
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
        marginBottom: 12,
    },
    tabsContainer: {
        gap: 16,
        paddingBottom: 4,
    },
    tabButton: {
        paddingBottom: 8,
        alignItems: 'center',
    },
    tabLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
    },
    activeIndicatorWrapper: {
        position: 'absolute',
        bottom: 0,
        height: 2,
        width: '100%',
        alignItems: 'center',
    },
    activeIndicator: {
        width: '100%',
        height: 2,
    },
    listContainer: {
        width: '100%',
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
    viewAllButton: {
        backgroundColor: colors.bgShade20,
        height: 54, // Matched with View All from screenshot
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        width: '100%',
    },
    viewAllText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
});
