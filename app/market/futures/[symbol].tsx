import { OrderBook } from '@/components/features/market/detail/OrderBook';
import { PriceHeader } from '@/components/features/market/detail/PriceHeader';
import { RecentTrades } from '@/components/features/market/detail/RecentTrades';
import { ScreenHeader } from '@/components/features/market/detail/ScreenHeader';
import { TradingViewChart } from '@/components/features/market/detail/TradingViewChart';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useTokenDetail } from '@/hooks/useTokenDetail';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SubTab = 'Order Book' | 'Trades';

export default function FuturesMarketDetail() {
    const { symbol, address, chainId } = useLocalSearchParams<{
        symbol: string;
        address: string;
        chainId: string;
    }>();
    const { bottom } = useSafeAreaInsets();
    const [activeTab, setActiveTab] = React.useState<SubTab>('Order Book');

    const router = useRouter(); // Initialize router

    const { data: token, isLoading } = useTokenDetail({
        address,
        symbol,
        chainId: chainId ? parseInt(chainId) : undefined
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
            <View style={[styles.container, styles.center]}>
                <CustomStatusBar />
                <Text style={styles.loadingText}>Loading {symbol}...</Text>
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
            <ScreenHeader symbol={token.symbol} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottom + 100 }}
            >
                <PriceHeader token={token} />
                <TradingViewChart />

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
                    <OrderBook baseSymbol={token.symbol} />
                ) : (
                    <RecentTrades />
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
