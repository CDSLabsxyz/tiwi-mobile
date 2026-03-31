import { PriceHeader } from '@/components/features/market/detail/PriceHeader';
import { ScreenHeader } from '@/components/features/market/detail/ScreenHeader';
import { TokenAbout } from '@/components/features/market/detail/TokenAbout';
import { TradingViewChart } from '@/components/features/market/detail/TradingViewChart';
import { TokenPoolStats } from '@/components/features/market/detail/TokenPoolStats';
import { TokenPriceChange } from '@/components/features/market/detail/TokenPriceChange';
import { TokenTransactionsSummary } from '@/components/features/market/detail/TokenTransactionsSummary';
import { TokenTransactions } from '@/components/features/market/detail/TokenTransactions';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { useEnrichedMarketDetail } from '@/hooks/useEnrichedMarketDetail';
import { useMarketStore } from '@/store/marketStore';
import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';
import { getChainName } from '@/utils/chain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type ActiveContent = "Overview" | "Activities";

export default function SpotMarketDetail() {
    const { symbol, address, chainId, provider, name } = useLocalSearchParams<{
        symbol: string;
        address: string;
        chainId: string;
        provider: 'binance' | 'dydx' | 'onchain';
        name: string;
    }>();
    const { bottom } = useSafeAreaInsets();
    const { favorites, toggleFavorite, isFavorite } = useMarketStore();
    const [activeContent, setActiveContent] = useState<ActiveContent>("Overview");

    // 1. Fetch basic enriched market detail
    const { data: enrichedToken, isLoading: isEnrichedLoading } = useEnrichedMarketDetail({
        symbol: symbol || '',
        address: address,
        chainId: chainId ? parseInt(chainId, 10) : undefined,
        marketType: 'spot',
    });

    // 2. Fetch deep token info (exactly like web app)
    const parsedChainId = chainId ? parseInt(chainId, 10) : enrichedToken?.chainId;
    const effectiveAddress = (address && address.startsWith('0x')) ? address : (enrichedToken?.contractAddress || enrichedToken?.address);
    const normalizedAddress = effectiveAddress?.toString()?.toLowerCase();

    const { data: tokenInfo, isLoading: isInfoLoading, error: errorInfo } = useQuery<any, Error>({
        queryKey: ['tokenInfo', parsedChainId, normalizedAddress],
        queryFn: async () => {
            if (!parsedChainId || !normalizedAddress) return null;
            return api.tokenInfo.get(parsedChainId, normalizedAddress);
        },
        enabled: !!parsedChainId && !!normalizedAddress && normalizedAddress !== 'native',
        staleTime: 30 * 1000,
    });

    const token = enrichedToken;
    const pool = tokenInfo?.pool;
    const transactions = (tokenInfo?.transactions || []).map((t: any) => ({
        ...t,
        hash: t.txHash || t.hash,
        amountToken: t.amount,
        amountUsd: t.valueUsd,
        priceUsd: t.priceUsd
    })) as any[];

    const router = useRouter();

    // Build consistent favorite ID
    const favoriteId = token?.id || symbol || '';

    const handleToggleFavorite = () => {
        toggleFavorite(favoriteId, {
            id: favoriteId,
            symbol: token?.symbol || symbol,
            name: token?.name || name || symbol,
            address: effectiveAddress || address,
            chainId: parsedChainId,
            logoURI: token?.logoURI || token?.logo,
            priceUSD: pool?.priceUsd?.toString() || token?.priceUSD,
            priceChange24h: token?.priceChange24h || 0,
        });
    };

    const handleTrade = () => {
        router.push({
            pathname: '/swap',
            params: {
                symbol: token?.symbol,
                chainId: tokenInfo?.chainId || parsedChainId || 56,
                assetId: effectiveAddress,
                logo: token?.logoURI || token?.logo,
                name: token?.name,
                priceUSD: pool?.priceUsd?.toString()
            }
        });
    };

    if (isEnrichedLoading) {
        return (
            <View style={[styles.container, styles.center, {}]}>
                <CustomStatusBar />
                <TIWILoader size={80} />
                <Text style={styles.loadingText}>FETCHING MARKET DATA...</Text>
            </View>
        );
    }

    if (!token) {
        return (
            <View style={[styles.container, styles.center]}>
                <CustomStatusBar />
                <Text style={styles.loadingText}>Token not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <ScreenHeader
                symbol={token.displaySymbol || token.symbol}
                logoURI={token.logoURI}
                isFavorite={isFavorite(favoriteId)}
                onToggleFavorite={handleToggleFavorite}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottom + 120 }}
            >
                <PriceHeader 
                    token={{
                        ...token,
                        price: pool?.priceUsd ? pool.priceUsd.toString() : token.price,
                        priceChange24h: pool?.priceChange24h !== undefined ? pool.priceChange24h : token.priceChange24h
                    }} 
                    chainName={getChainName(tokenInfo?.chainId || parsedChainId)}
                />

                <TradingViewChart
                    symbol={token.displaySymbol || token.symbol}
                    baseSymbol={token.symbol}
                    marketType="spot"
                    precision={token.decimals}
                    price={pool?.priceUsd || (typeof token.price === 'string' ? parseFloat(token.price) : token.price)}
                    baseAddress={effectiveAddress}
                    quoteAddress={pool?.address === effectiveAddress ? undefined : pool?.address}
                    chainId={parsedChainId}
                    provider={token.provider}
                />

                {/* Sub Tabs Toggle (Matches web transition between tabs) */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        onPress={() => setActiveContent("Overview")}
                        style={[styles.tabButton, activeContent === "Overview" && styles.activeTabButton]}
                    >
                        <Text style={[styles.tabText, activeContent === "Overview" && styles.activeTabText]}>Stats</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveContent("Activities")}
                        style={[styles.tabButton, activeContent === "Activities" && styles.activeTabButton]}
                    >
                        <Text style={[styles.tabText, activeContent === "Activities" && styles.activeTabText]}>Activities</Text>
                    </TouchableOpacity>
                </View>

                {activeContent === "Overview" ? (
                    <View>
                        {/* FDV & Pool Metrics (Matches web layout) */}
                        {pool && (
                            <TokenPoolStats
                                liquidity={pool.liquidity}
                                volume24h={pool.volume24h}
                                marketCap={pool.marketCap}
                                fdv={pool.fdv}
                                holders={tokenInfo?.holders}
                            />
                        )}

                        {/* Price Change Grid (Matches web layout) */}
                        {pool && (
                            <TokenPriceChange
                                priceChange5m={pool.priceChange5m}
                                priceChange1h={pool.priceChange1h}
                                priceChange24h={pool.priceChange24h}
                            />
                        )}

                        {/* 24h Transaction Bars (Matches web layout) */}
                        {pool && (
                            <TokenTransactionsSummary
                                total={pool.txns24h}
                                buys={pool.buys24h}
                                sells={pool.sells24h}
                            />
                        )}

                        <TokenAbout
                            token={tokenInfo?.token || token}
                            chainId={tokenInfo?.chainId || parsedChainId}
                        />
                    </View>
                ) : (
                    <TokenTransactions
                        transactions={transactions}
                        tokenSymbol={token.symbol}
                        tokenAddress={effectiveAddress}
                        chainId={parsedChainId || 56}
                    />
                )}
            </ScrollView>

            {/* Bottom Action Bar (Matches Web Mobile Design with star icon next to button) */}
            <View style={[styles.actionBar, { paddingBottom: Math.max(bottom, 20) }]}>
                <TouchableOpacity
                    onPress={handleToggleFavorite}
                    activeOpacity={0.7}
                    style={styles.favoriteButton}
                >
                    <Ionicons
                        name={isFavorite(favoriteId) ? "star" : "star-outline"}
                        size={24}
                        color={isFavorite(favoriteId) ? colors.primaryCTA : colors.mutedText}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleTrade}
                    activeOpacity={0.9}
                    style={styles.tradeButton}
                >
                    <Text style={styles.tradeButtonText}>Swap {token.symbol}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    center: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: colors.primaryCTA,
        marginTop: 16,
        fontSize: 10,
        fontWeight: 'bold',
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
        marginTop: 16,
        marginBottom: 8,
    },
    tabButton: {
        paddingVertical: 12,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabButton: {
        borderBottomColor: colors.primaryCTA,
    },
    tabText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.mutedText,
    },
    activeTabText: {
        color: colors.primaryCTA,
    },
    actionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
        alignItems: 'center',
    },
    favoriteButton: {
        width: 52,
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgSemi,
    },
    tradeButton: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tradeButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.bg,
    },
});

