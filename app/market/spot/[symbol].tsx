import { PriceHeader } from '@/components/features/market/detail/PriceHeader';
import { ScreenHeader } from '@/components/features/market/detail/ScreenHeader';
import { SupplyMetrics } from '@/components/features/market/detail/SupplyMetrics';
import { TokenAbout } from '@/components/features/market/detail/TokenAbout';
import { TokenMetrics } from '@/components/features/market/detail/TokenMetrics';
import { TradingViewChart } from '@/components/features/market/detail/TradingViewChart';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useEnrichedMarketDetail } from '@/hooks/useEnrichedMarketDetail';
import { useMarketStore } from '@/store/marketStore';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SpotMarketDetail() {
    const { symbol, address, chainId, provider, name } = useLocalSearchParams<{
        symbol: string;
        address: string;
        chainId: string;
        provider: 'binance' | 'dydx' | 'onchain';
        name: string;
    }>();
    const { bottom } = useSafeAreaInsets();
    const { isFavorite, toggleFavorite } = useMarketStore();

    const { data: token, isLoading } = useEnrichedMarketDetail({
        symbol: symbol || '',
        address: address,
        chainId: chainId ? parseInt(chainId, 10) : undefined,
        marketType: 'spot',
    });

    const handleBuy = () => Alert.alert('Buy', 'Buy flow coming soon');
    const handleSell = () => Alert.alert('Sell', 'Sell flow coming soon');

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

    return (
        <View style={styles.container}>
            <CustomStatusBar />
            <ScreenHeader
                symbol={token.displaySymbol || token.symbol}
                logoURI={token.logoURI}
                isFavorite={isFavorite(token.id)}
                onToggleFavorite={() => toggleFavorite(token.id)}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottom + 100 }}
            >
                <PriceHeader token={token} />
                <TradingViewChart
                    symbol={token.displaySymbol || token.symbol}
                    baseSymbol={token.symbol}
                    marketType="spot"
                    precision={token.decimals}
                    price={typeof token.price === 'string' ? parseFloat(token.price) : token.price}
                    baseAddress={token.baseToken?.address || token.contractAddress || token.address}
                    quoteAddress={token.quoteToken?.address}
                    chainId={token.chainId}
                    provider={token.provider}
                />

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Position</Text>
                    <View style={styles.emptyCard}>
                        {/* <Image
                            source={require('@/assets/images/empty-position.png')}
                            style={styles.emptyImage}
                       /> */}
                        <Text style={styles.emptyText}>No Available Data</Text>
                    </View>
                </View>

                <TokenAbout token={token} />
                <TokenMetrics token={token} />
                <SupplyMetrics token={token} />
            </ScrollView>

            <View style={[styles.actionBar, { paddingBottom: bottom > 0 ? bottom : 12 }]}>
                <TouchableOpacity
                    onPress={handleBuy}
                    activeOpacity={0.9}
                    style={[styles.actionButton, styles.buyButton]}
                >
                    <Text style={styles.buyText}>Buy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleSell}
                    activeOpacity={0.9}
                    style={[styles.actionButton, styles.sellButton]}
                >
                    <Text style={styles.sellText}>Sell</Text>
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
    section: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
        marginBottom: 12,
    },
    emptyCard: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
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
