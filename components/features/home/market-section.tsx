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
    const [activeTab, setActiveTab] = useState<string>('explore');
    const { favorites, isFavorite, getFavoriteTokens } = useMarketStore();

    const tabs: { id: string; label: string }[] = useMemo(() => [
        { id: 'favourite', label: t('home.favourite') },
        { id: 'explore', label: 'Explore' },
        { id: 'spotlight', label: 'Spotlight' },
        { id: 'listing', label: 'Listing' },
        { id: 'gainers', label: t('home.gainers') },
        { id: 'losers', label: t('home.losers') },
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

    // 2. Fetch Spotlight/Listing tokens with price enrichment (like web app)
    const { data: adminTokens = [], isLoading: isAdminLoading } = useQuery({
        queryKey: ['homeAdminEnriched', activeTab],
        queryFn: async () => {
            const res = await api.tokenSpotlight.get({
                category: activeTab === 'listing' ? 'listing' : 'spotlight',
                activeOnly: true
            });
            const raw = Array.isArray(res.tokens) ? res.tokens : [];
            const today = new Date().toISOString().split('T')[0];
            const active = raw
                .filter((t: any) => (!t.startDate || t.startDate <= today) && (!t.endDate || t.endDate >= today))
                .sort((a: any, b: any) => (a.rank || 0) - (b.rank || 0));

            const enriched = await Promise.all(active.map(async (st: any) => {
                const match = (marketPairs || []).find((et: any) =>
                    et.symbol?.toUpperCase() === st.symbol?.toUpperCase() ||
                    (st.address && et.address?.toLowerCase() === st.address?.toLowerCase())
                );
                if (match && match.price && parseFloat(String(match.price)) > 0) {
                    return { ...match, logoURI: match.logoURI || match.logo || st.logo || '' };
                }
                const cid = st.chainId || 56;
                if (st.address) {
                    try {
                        const info = await api.tokenInfo.get(cid, st.address);
                        const pool = info?.pool;
                        if (pool) {
                            return {
                                id: st.id || `${cid}-${st.address}`, symbol: st.symbol, displaySymbol: st.symbol,
                                name: st.name || st.symbol, address: st.address, chainId: cid,
                                logoURI: st.logo || info?.token?.logo || '', logo: st.logo || info?.token?.logo || '',
                                price: pool.priceUsd ? String(pool.priceUsd) : '0', priceUSD: pool.priceUsd ? String(pool.priceUsd) : '0',
                                priceChange24h: pool.priceChange24h || 0, volume24h: pool.volume24h || 0,
                                marketCap: pool.marketCap || 0, marketType: 'spot',
                            };
                        }
                    } catch {}
                }
                return {
                    id: st.id || st.symbol, symbol: st.symbol, displaySymbol: st.symbol,
                    name: st.name || st.symbol, address: st.address || '', chainId: cid,
                    logoURI: st.logo || '', logo: st.logo || '', price: '0', priceUSD: '0',
                    priceChange24h: 0, volume24h: 0, marketCap: 0, marketType: 'spot',
                };
            }));
            return { tokens: enriched };
        },
        enabled: activeTab === 'spotlight' || activeTab === 'listing',
        staleTime: 30 * 1000,
    });

    // 3. Load favorites from store (no API call needed)
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
        } as any));
    }, [favorites]);
    const isFavLoading = false;

    // 4. Derive display data
    const displayData = useMemo<MarketAsset[]>(() => {
        let tokens: MarketAsset[] = activeTab === 'favourite' ? favoriteTokens : [...((marketPairs as any) || [])];

        // Spotlight/Listing tokens already enriched with prices
        if (activeTab === 'spotlight' || activeTab === 'listing') {
            const enrichedTokens = Array.isArray(adminTokens.tokens) ? adminTokens.tokens : [];
            return enrichedTokens.slice(0, 5) as any;
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
            } else if (activeTab === 'explore') {
                tokens = tokens.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
            } else if (activeTab === 'explore') {
                // For Explore on home, we just show top tokens by volume as well or default order
                tokens = tokens.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
            }
        }

        // Always put TWC first in explore
        if (activeTab === 'explore' || activeTab === 'favourite') {
            const twcIndex = tokens.findIndex(t => t.symbol?.toUpperCase() === 'TWC');
            if (twcIndex > 0) {
                const [twc] = tokens.splice(twcIndex, 1);
                tokens.unshift(twc);
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
