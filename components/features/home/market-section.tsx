import { Skeleton } from '@/components/ui/skeleton';
import { TokenPrice } from '@/components/ui/TokenPrice';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { MarketCategory, useMarketPairs } from '@/hooks/useMarketPairs';
import { apiClient, MarketTokenPair, TokenMetadata } from '@/services/apiClient';
import { useMarketStore } from '@/store/marketStore';
import { TradingPair } from '@/types';
import { formatNumber, formatPercentageChange } from '@/utils/formatting';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MarketSectionProps {
    // pairs prop is now ignored as we fetch internally, but kept for compatibility
    pairs?: TradingPair[];
    isLoading?: boolean;
}

const tabs: { id: MarketCategory | 'favourite'; label: string }[] = [
    { id: 'favourite', label: 'Favourite' },
    { id: 'hot', label: 'Top' },
    { id: 'new', label: 'New' },
    { id: 'gainers', label: 'Gainers' },
    { id: 'losers', label: 'Losers' },
];

/**
 * Market Section
 * Tabbed interface with trading pairs list
 */
export const MarketSection: React.FC<MarketSectionProps> = ({
    isLoading: initialLoading = false,
}) => {
    const router = useRouter();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<MarketCategory | 'favourite'>('hot');
    const { favorites, toggleFavorite, isFavorite } = useMarketStore();

    const tabs: { id: MarketCategory | 'favourite'; label: string }[] = useMemo(() => [
        { id: 'favourite', label: t('home.favourite') },
        { id: 'hot', label: t('home.top') },
        { id: 'new', label: t('home.new') },
        { id: 'gainers', label: t('home.gainers') },
        { id: 'losers', label: t('home.losers') },
    ], [t]);

    // Fetch categories (Hot, New, Gainers, Losers)
    const {
        data: marketPairs,
        isLoading: isPairsLoading,
    } = useMarketPairs({
        category: activeTab === 'favourite' ? 'hot' : activeTab as MarketCategory,
        limit: 5, // Display top 5 on home screen
        enabled: activeTab !== 'favourite'
    });

    // Fetch favorites
    const [favoriteTokens, setFavoriteTokens] = useState<MarketTokenPair[]>([]);
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
                        const tokens = await apiClient.getTokens({
                            address,
                            chains: [parseInt(chainId)],
                            limit: 1
                        });
                        return tokens.tokens[0];
                    } catch (e) {
                        return null;
                    }
                });

                const results = await Promise.all(promises);
                const validResults = results.filter((t): t is TokenMetadata => !!t && !!t.address);

                const mappedFavs: MarketTokenPair[] = validResults.map(t => ({
                    ...t,
                    address: t.address,
                    symbol: t.symbol,
                    name: t.name,
                    chainId: t.chainId,
                    decimals: t.decimals || 18,
                    priceUSD: t.priceUSD || '0',
                    logoURI: t.logoURI || '',
                    verified: !!t.verified,
                    priceChange24h: t.priceChange24h ? parseFloat(String(t.priceChange24h)) : 0,
                    volume24h: typeof t.volume24h === 'number' ? t.volume24h : parseFloat(String(t.volume24h || '0')),
                    marketCap: typeof t.marketCap === 'number' ? t.marketCap : parseFloat(String(t.marketCap || '0')),
                    holders: typeof t.holders === 'number' ? t.holders : parseInt(String(t.holders || '0')),
                    transactionCount: typeof t.transactionCount === 'number' ? t.transactionCount : parseInt(String(t.transactionCount || '0')),
                }));

                setFavoriteTokens(mappedFavs);
            } catch (error) {
                console.error('[MarketSection] Error loading favorites:', error);
            } finally {
                setIsFavLoading(false);
            }
        };

        loadFavs();
    }, [activeTab, favorites]);

    const displayData = useMemo(() => {
        if (activeTab === 'favourite') {
            return favoriteTokens;
        }
        return marketPairs || [];
    }, [activeTab, favoriteTokens, marketPairs]);
    const isLoading = activeTab === 'favourite' ? isFavLoading : isPairsLoading;

    if (isLoading && displayData.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <Skeleton width={54} height={22} borderRadius={4} />
                <View style={styles.loadingTabs}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} width={50} height={16} borderRadius={4} />
                    ))}
                </View>
                <View style={styles.loadingList}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} width="100%" height={55} borderRadius={0} />
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{t('home.market')}</Text>
                </View>

                {/* Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tabsScroll}
                    contentContainerStyle={styles.tabsContainer}
                >
                    {tabs.map((tab) => {
                        const isActive = tab.id === activeTab;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id as any)}
                                style={styles.tabButton}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        { color: isActive ? colors.primaryCTA : colors.bodyText }
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                                {isActive && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={styles.listContainer}>
                {displayData.map((token: MarketTokenPair) => {
                    if (!token || !token.address) return null;

                    const tokenId = `${token.chainId}-${token.address.toLowerCase()}`;
                    const favorited = isFavorite(tokenId);

                    return (
                        <TouchableOpacity
                            key={`${token.chainId}-${token.address}`}
                            style={styles.pairItem}
                            activeOpacity={0.7}
                            onPress={() => {
                                const symbolParam = token.symbol.toLowerCase();
                                router.push({
                                    pathname: `/market/spot/${symbolParam}` as any,
                                    params: {
                                        address: token.address,
                                        chainId: token.chainId,
                                        symbol: token.symbol
                                    }
                                });
                            }}
                        >
                            {/* Logo & Favorite */}
                            <View style={styles.logoAndStar}>
                                <TouchableOpacity
                                    onPress={() => toggleFavorite(tokenId)}
                                    style={styles.starButton}
                                >
                                    <Image
                                        source={favorited
                                            ? require('@/assets/home/star-18.svg')
                                            : require('@/assets/home/star.svg')
                                        }
                                        style={styles.starIcon}
                                    />
                                </TouchableOpacity>
                                <Image
                                    source={token.logoURI}
                                    style={styles.pairLogo}
                                    contentFit="cover"
                                />
                            </View>

                            {/* Info */}
                            <View style={styles.pairInfo}>
                                <View style={styles.symbolRow}>
                                    <Text
                                        style={styles.baseSymbol}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {token.symbol}
                                    </Text>
                                    <Text style={styles.quoteSymbol}>-USD</Text>
                                    {token.marketCapRank && (
                                        <View style={styles.leverageBadge}>
                                            <Text style={styles.leverageText}>#{token.marketCapRank}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.volumeText} numberOfLines={1}>
                                    {t('home.vol')} {formatNumber(token.volume24h || 0)}
                                </Text>
                            </View>

                            {/* Price and Change */}
                            <View style={styles.priceContainer}>
                                <TokenPrice
                                    amount={token.priceUSD}
                                    style={styles.priceText}
                                />
                                <Text
                                    style={[
                                        styles.changeText,
                                        { color: (token.priceChange24h || 0) >= 0 ? colors.success : colors.error }
                                    ]}
                                >
                                    {formatPercentageChange(token.priceChange24h || 0).formatted}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}

                {activeTab === 'favourite' && favorites.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{t('home.no_favorites')}</Text>
                    </View>
                )}

                {/* View All Button */}
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
        alignItems: 'center',
        paddingVertical: 8,
    },
    loadingContainer: {
        width: '100%',
        gap: 12,
        paddingHorizontal: 20,
    },
    loadingTabs: {
        flexDirection: 'row',
        gap: 16,
    },
    loadingList: {
        gap: 8,
    },
    header: {
        width: '100%',
        gap: 8,
    },
    titleContainer: {
        width: '100%',
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    tabsScroll: {
        borderBottomWidth: 0.5,
        borderBottomColor: colors.bgStroke,
    },
    tabsContainer: {
        gap: 16,
        height: 32, // Controlled height for consistent alignment
    },
    tabButton: {
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 6, // Space for indicator
    },
    tabLabel: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        height: 1,
        width: '100%',
        backgroundColor: colors.primaryCTA,
    },
    listContainer: {
        width: '100%',
        paddingTop: 8,
    },
    pairItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        width: '100%',
    },
    logoAndStar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    starButton: {
        padding: 4,
    },
    starIcon: {
        width: 16,
        height: 16,
    },
    pairLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    pairInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    symbolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        // gap: 6,
    },
    baseSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
        flexShrink: 1,
    },
    quoteSymbol: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    leverageBadge: {
        backgroundColor: colors.bgStroke,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    leverageText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.bodyText,
    },
    volumeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
        marginTop: 2,
    },
    priceContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    priceText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    changeText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        marginTop: 2,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    viewAllButton: {
        backgroundColor: colors.bgShade20,
        height: 48,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        width: '100%',
    },
    viewAllText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
});
