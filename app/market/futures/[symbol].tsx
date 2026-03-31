import { OrderBook } from '@/components/features/market/detail/OrderBook';
import { PriceHeader } from '@/components/features/market/detail/PriceHeader';
import { RecentTrades } from '@/components/features/market/detail/RecentTrades';
import { ScreenHeader } from '@/components/features/market/detail/ScreenHeader';
import { TradingViewChart } from '@/components/features/market/detail/TradingViewChart';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useEnrichedMarketDetail } from '@/hooks/useEnrichedMarketDetail';
import { useMarketStore } from '@/store/marketStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SubTab = 'Order Book' | 'Trades';

export default function FuturesMarketDetail() {
    const { symbol, address, chainId, provider } = useLocalSearchParams<{
        symbol: string;
        address: string;
        chainId: string;
        provider: 'binance' | 'dydx' | 'onchain';
    }>();
    const { bottom } = useSafeAreaInsets();
    const { isFavorite, toggleFavorite } = useMarketStore();
    const [activeTab, setActiveTab] = React.useState<SubTab>('Order Book');

    const router = useRouter();

    const { data: token, isLoading } = useEnrichedMarketDetail({
        symbol: symbol || '',
        address: address,
        chainId: chainId ? parseInt(chainId, 10) : undefined,
        marketType: 'perp',
        provider: provider
    });

    // Navigate to the dedicated Perps Trading Screen
    const handleLong = () => {
        router.push({
            pathname: "/trade/perp/[symbol]",
            params: { symbol, address, chainId, side: 'long' }
        });
    };

    const handleShort = () => {
        router.push({
            pathname: "/trade/perp/[symbol]",
            params: { symbol, address, chainId, side: 'short' }
        });
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <CustomStatusBar />
                {/* <LoadingOverlay
                    visible={isLoading}
                    mode="high-contrast"
                /> */}
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

    const favoriteId = token.id || symbol || '';

    const handleToggleFavorite = () => {
        toggleFavorite(favoriteId, {
            id: favoriteId,
            symbol: token.symbol || symbol,
            name: token.name || symbol,
            address: token.address || address,
            chainId: token.chainId || (chainId ? parseInt(chainId) : undefined),
            logoURI: token.logoURI || token.logo,
            priceUSD: token.priceUSD,
            priceChange24h: token.priceChange24h || 0,
        });
    };

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
                contentContainerStyle={{ paddingBottom: bottom + 100 }}
            >
                <PriceHeader token={token} />
                <TradingViewChart
                    symbol={token.displaySymbol || token.symbol}
                    baseSymbol={token.symbol}
                    marketType="perp"
                    precision={token.decimals}
                    price={typeof token.price === 'string' ? parseFloat(token.price) : token.price}
                    baseAddress={token.baseToken?.address || token.contractAddress || token.address}
                    quoteAddress={token.quoteToken?.address}
                    chainId={token.chainId}
                    provider={token.provider}
                />

                {/* Tabs for Order Book / Trades */}
                <View style={styles.tabContainer}>
                    {(['Order Book', 'Trades'] as SubTab[]).map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={[styles.tabButton, activeTab === tab && styles.tabActive]}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {activeTab === 'Order Book' ? (
                    <OrderBook
                        symbol={token.displaySymbol || token.symbol}
                        baseSymbol={token.symbol}
                        address={token.address}
                        chainId={token.chainId}
                        marketType="perp"
                    />
                ) : (
                    <RecentTrades
                        symbol={token.displaySymbol || token.symbol}
                        marketType="perp"
                    />
                )}
            </ScrollView>

            <View style={[styles.actionBar, { paddingBottom: bottom > 0 ? bottom : 12 }]}>
                <TouchableOpacity
                    onPress={handleLong}
                    activeOpacity={0.9}
                    style={[styles.actionButton, styles.buyButton]}
                >
                    <Text style={styles.buyText}>Long</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleShort}
                    activeOpacity={0.9}
                    style={[styles.actionButton, styles.sellButton]}
                >
                    <Text style={styles.sellText}>Short</Text>
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
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.bodyText,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        backgroundColor: colors.bg,
    },
    tabButton: {
        paddingVertical: 14,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: colors.titleText,
    },
    tabText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    tabTextActive: {
        fontFamily: 'Manrope-SemiBold',
        color: colors.titleText,
    },
    actionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    actionButton: {
        flex: 1,
        height: 52,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyButton: {
        backgroundColor: colors.primaryCTA,
    },
    sellButton: {
        backgroundColor: colors.error,
    },
    buyText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.bg,
    },
    sellText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
});
