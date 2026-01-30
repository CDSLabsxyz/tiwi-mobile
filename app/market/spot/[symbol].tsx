import { PriceHeader } from '@/components/features/market/detail/PriceHeader';
import { ScreenHeader } from '@/components/features/market/detail/ScreenHeader';
import { SupplyMetrics } from '@/components/features/market/detail/SupplyMetrics';
import { TokenAbout } from '@/components/features/market/detail/TokenAbout';
import { TokenMetrics } from '@/components/features/market/detail/TokenMetrics';
import { TradingViewChart } from '@/components/features/market/detail/TradingViewChart';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useTokenDetail } from '@/hooks/useTokenDetail';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SpotMarketDetail() {
    const { symbol, address, chainId } = useLocalSearchParams<{
        symbol: string;
        address: string;
        chainId: string;
    }>();
    const { bottom } = useSafeAreaInsets();

    const { data: token, isLoading } = useTokenDetail({
        address,
        symbol,
        chainId: chainId ? parseInt(chainId) : undefined
    });

    const handleBuy = () => Alert.alert('Buy', 'Buy flow coming soon');
    const handleSell = () => Alert.alert('Sell', 'Sell flow coming soon');

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

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Position</Text>
                    <View style={styles.emptyCard}>
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
        paddingVertical: 16,
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
