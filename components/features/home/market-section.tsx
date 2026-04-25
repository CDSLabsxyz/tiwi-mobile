import { TokenListItem } from '@/components/sections/Market/TokenListItem';
import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useEnrichedMarkets } from '@/hooks/useEnrichedMarkets';
import { useTranslation } from '@/hooks/useLocalization';
import { useTWCToken } from '@/hooks/useTWCToken';
import { api, MarketAsset, TokenItem } from '@/lib/mobile/api-client';
import { useMarketStore } from '@/store/marketStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Line indicator for active tab
const imgLine327 = 'https://www.figma.com/api/mcp/asset/2040f48a-ef4a-465d-85f9-1bc8eb6c0987';

// Disk cache for the per-tab admin-enriched roster (Spotlight / Listing).
// Loaded once at module boot so tab switches render synchronously from disk
// while the API refetch happens in background.
const ADMIN_CACHE_KEY_PREFIX = '@tiwi/home-adminEnriched-';
const adminDiskCache: Record<string, { data: any; updatedAt: number }> = {};
AsyncStorage.getAllKeys()
    .then(keys => {
        const ours = keys.filter(k => k.startsWith(ADMIN_CACHE_KEY_PREFIX));
        if (!ours.length) return;
        return AsyncStorage.multiGet(ours).then(entries => {
            for (const [key, value] of entries) {
                if (!value) continue;
                try {
                    const id = key.replace(ADMIN_CACHE_KEY_PREFIX, '');
                    adminDiskCache[id] = JSON.parse(value);
                } catch {}
            }
        });
    })
    .catch(() => {});

// Canonical TWC fallback so it always shows on Explore even if the upstream
// market list hasn't returned it (cold start, paginated list, network hiccup).
const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
const TWC_FALLBACK = {
    id: `56-${TWC_ADDRESS.toLowerCase()}`,
    chainId: 56,
    address: TWC_ADDRESS,
    symbol: 'TWC',
    displaySymbol: 'TWC',
    name: 'TIWI Coin',
    logoURI: require('../../../assets/home/tiwicat-token.svg'),
    price: '0',
    priceUSD: '0',
    priceChange24h: 0,
    volume24h: 0,
    marketCap: 0,
    marketType: 'spot' as const,
    provider: 'onchain' as const,
    rank: 1,
};

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
    // Live TWC data — used to enrich the fallback with real price/24h change
    // when TWC is missing from the upstream market list.
    const { data: twcLive } = useTWCToken();

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
        // Enabled on Favourite too — needed to enrich saved favorites with
        // live volume / market cap / current price.
        enabled: true,
    });

    // 2. Fetch Spotlight/Listing tokens with price enrichment (like web app)
    const adminCacheId = activeTab;
    const adminCached = adminDiskCache[adminCacheId];
    const adminHasSavedRef = useRef<Record<string, boolean>>({});
    const { data: adminTokens = [], isLoading: isAdminLoading, dataUpdatedAt: adminUpdatedAt, isPlaceholderData: adminIsPlaceholder } = useQuery({
        queryKey: ['homeAdminEnriched', activeTab],
        initialData: adminCached?.data,
        initialDataUpdatedAt: adminCached?.updatedAt,
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
                const cid = st.chainId || 56;
                // Match against the same enriched list Explore uses so the
                // Spotlight/Listing tabs show identical price/24h/volume for
                // a shared token. Strip CEX pair suffixes (`BTCUSDT` → `BTC`)
                // so the base ticker resolves.
                const stSym = (st.symbol || '').toUpperCase();
                const stAddr = (st.address || '').toLowerCase();
                const match = (marketPairs || []).find((et: any) => {
                    const etSym = (et.symbol || '').toUpperCase();
                    const etDisplay = ((et as any).displaySymbol || etSym.split('-')[0].split('/')[0]).toUpperCase();
                    if (etSym === stSym || etDisplay === stSym) return true;
                    if (st.address && et.address && et.address.toLowerCase() === stAddr) return true;
                    return false;
                });
                if (match && (parseFloat(String(match.price || match.priceUSD || 0)) > 0 || match.priceChange24h !== undefined)) {
                    return { ...match, logoURI: match.logoURI || match.logo || st.logo || '' };
                }

                // Server-side enrichment (enrichAdminTokenRow) already populates
                // price/volume/24h on the spotlight/listing response. Use those when
                // the live market cache misses so newly-listed tokens don't render $0.
                const serverPrice = st.price ?? st.priceUSD;
                const serverHasData =
                    (serverPrice !== undefined && serverPrice !== null && parseFloat(String(serverPrice)) > 0) ||
                    (st.volume24h ?? 0) > 0 ||
                    (st.marketCap ?? 0) > 0;

                if (serverHasData) {
                    return {
                        id: st.id || `${cid}-${st.address || st.symbol}`,
                        symbol: st.symbol, displaySymbol: st.symbol,
                        name: st.name || st.symbol, address: st.address || '', chainId: cid,
                        logoURI: st.logo || '', logo: st.logo || '',
                        price: serverPrice ? String(serverPrice) : '0',
                        priceUSD: serverPrice ? String(serverPrice) : '0',
                        priceChange24h: st.priceChange24h || 0,
                        volume24h: st.volume24h || 0,
                        marketCap: st.marketCap || 0,
                        liquidity: st.liquidity || 0,
                        fdv: st.fdv || 0,
                        marketCapRank: st.marketCapRank || st.rank,
                        marketType: 'spot',
                    };
                }

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

    // Persist fresh admin-enriched data per tab so cold loads render instantly.
    useEffect(() => {
        if (activeTab !== 'spotlight' && activeTab !== 'listing') return;
        const list = Array.isArray((adminTokens as any)?.tokens) ? (adminTokens as any).tokens : [];
        if (list.length > 0 && !adminIsPlaceholder && adminUpdatedAt > (adminDiskCache[adminCacheId]?.updatedAt || 0)) {
            if (!adminHasSavedRef.current[adminCacheId]) {
                adminHasSavedRef.current[adminCacheId] = true;
                const payload = { data: adminTokens, updatedAt: Date.now() };
                adminDiskCache[adminCacheId] = payload;
                AsyncStorage.setItem(`${ADMIN_CACHE_KEY_PREFIX}${adminCacheId}`, JSON.stringify(payload)).catch(() => {});
            }
        } else {
            adminHasSavedRef.current[adminCacheId] = false;
        }
    }, [adminTokens, adminUpdatedAt, adminIsPlaceholder, adminCacheId, activeTab]);

    // 3. Build favourites by resolving each saved favourite to its exact entry
    // in the Explore list so price / 24h / volume match Explore 1:1. CEX
    // tokens (BTC/USDT/SOL) often have a different `id` format in the market
    // list than what's persisted on favourite, so match also by chainId-address
    // and, as a last resort, by uppercase symbol. Falls back to the persisted
    // snapshot only if no Explore entry is found.
    const favoriteTokens = useMemo<MarketAsset[]>(() => {
        const saved = getFavoriteTokens();
        const byId = new Map<string, any>();
        const byAddrKey = new Map<string, any>();
        const bySymbol = new Map<string, any>();
        ((marketPairs as any[]) || []).forEach((m: any) => {
            if (m.id) byId.set(m.id.toLowerCase(), m);
            if (m.address) byAddrKey.set(`${m.chainId}-${m.address.toLowerCase()}`, m);
            // Index by both raw symbol and displaySymbol — CEX pairs come back
            // as `BTCUSDT`/`TWC-USDT` while favourites persist the base ticker
            // (`BTC`/`TWC`). Prefer entries with a real address over synthetic
            // CEX rows so we pick the on-chain row first when both exist.
            const register = (key: string) => {
                if (!key) return;
                const K = key.toUpperCase();
                const existing = bySymbol.get(K);
                if (!existing) bySymbol.set(K, m);
                else if (!existing.address && m.address) bySymbol.set(K, m);
            };
            register(m.symbol);
            register(m.displaySymbol);
        });

        const twcAddrLower = TWC_ADDRESS.toLowerCase();
        const seenKeys = new Set<string>();
        const out: MarketAsset[] = [];

        for (const t of saved) {
            const idKey = (t.id || '').toLowerCase();
            const addrKey = `${t.chainId}-${(t.address || '').toLowerCase()}`;
            let live =
                byId.get(idKey) ||
                (t.address ? byAddrKey.get(addrKey) : null) ||
                (t.symbol ? bySymbol.get(t.symbol.toUpperCase()) : null);

            // TWC is pinned to Explore via a live-enriched fallback when the
            // upstream list misses it. Mirror that here so Favourite shows the
            // same live price / 24h / volume instead of a $0 snapshot.
            const isTWC =
                (t.address && t.address.toLowerCase() === twcAddrLower) ||
                t.symbol?.toUpperCase() === 'TWC';
            if (!live && isTWC) {
                live = {
                    ...TWC_FALLBACK,
                    price: twcLive?.priceUSD || TWC_FALLBACK.price,
                    priceUSD: twcLive?.priceUSD || TWC_FALLBACK.priceUSD,
                    priceChange24h: twcLive?.priceChange24h ?? TWC_FALLBACK.priceChange24h,
                    volume24h: twcLive?.volume24h ?? TWC_FALLBACK.volume24h,
                    marketCap: twcLive?.marketCap ?? TWC_FALLBACK.marketCap,
                    logoURI: twcLive?.logoURI || TWC_FALLBACK.logoURI,
                };
            }

            const entry: MarketAsset = live
                ? (live as MarketAsset)
                : ({
                    ...t,
                    displaySymbol: t.symbol.toUpperCase(),
                    price: t.priceUSD ?? '0',
                    priceUSD: t.priceUSD ?? '0',
                    logoURI: t.logoURI || '',
                    priceChange24h: t.priceChange24h ?? 0,
                    volume24h: 0,
                    marketCap: 0,
                    marketType: 'spot',
                    provider: 'onchain',
                } as any);

            // Dedupe — users can accumulate multiple saved ids for the same
            // token (e.g. BTC saved once via /market detail, once via a CEX
            // row). Collapse them to a single row.
            const dedupeKey = entry.address
                ? `${entry.chainId}-${entry.address.toLowerCase()}`
                : ((entry as any).displaySymbol || entry.symbol || '').toUpperCase();
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);
            out.push(entry);
        }
        return out;
    }, [favorites, marketPairs, twcLive]);
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

        // Always put TWC first in explore. If TWC isn't in the upstream list
        // for any reason, inject a fallback enriched with live TWC data so the
        // row never shows $0.00 / +0.00%.
        if (activeTab === 'explore' || activeTab === 'favourite') {
            const twcAddrLower = TWC_ADDRESS.toLowerCase();
            const twcIndex = tokens.findIndex(t =>
                t.symbol?.toUpperCase() === 'TWC' ||
                t.address?.toLowerCase() === twcAddrLower
            );
            if (twcIndex > 0) {
                const [twc] = tokens.splice(twcIndex, 1);
                tokens.unshift(twc);
            } else if (twcIndex === -1 && activeTab === 'explore') {
                tokens.unshift({
                    ...TWC_FALLBACK,
                    price: twcLive?.priceUSD || TWC_FALLBACK.price,
                    priceUSD: twcLive?.priceUSD || TWC_FALLBACK.priceUSD,
                    priceChange24h: twcLive?.priceChange24h ?? TWC_FALLBACK.priceChange24h,
                    volume24h: twcLive?.volume24h ?? TWC_FALLBACK.volume24h,
                    marketCap: twcLive?.marketCap ?? TWC_FALLBACK.marketCap,
                    logoURI: twcLive?.logoURI || TWC_FALLBACK.logoURI,
                } as any);
            }
        }

        return tokens.slice(0, 5);
    }, [activeTab, favoriteTokens, marketPairs, adminTokens, twcLive]);

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
