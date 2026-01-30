import { OrderItem } from '@/components/features/trade/OrderItem';
import { PerpOrderBook } from '@/components/features/trade/PerpOrderBook';
import { PerpTradeForm } from '@/components/features/trade/PerpTradeForm';
import { PositionItem } from '@/components/features/trade/PositionItem';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useTokenDetail } from '@/hooks/useTokenDetail';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { formatPercentageChange } from '@/utils/formatting';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabType = 'Orders' | 'Positions';

export default function PerpTradeScreen() {
    const { symbol, address, chainId, side } = useLocalSearchParams<{
        symbol: string;
        address: string;
        chainId: string;
        side?: 'long' | 'short';
    }>();
    const router = useRouter();
    const { bottom, top } = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<TabType>('Orders');

    const { data: token } = useTokenDetail({
        address,
        symbol,
        chainId: chainId ? parseInt(chainId) : undefined
    });

    const { data: walletData } = useWalletBalances();

    const usdtBalance = useMemo(() => {
        if (!walletData?.tokens) return 0;
        const usdt = walletData.tokens.find(t => t.symbol === 'USDT' || t.symbol === 'USDC');
        return usdt ? parseFloat(usdt.balance) : 0;
    }, [walletData]);

    // Mock Data for Demo
    const mockOrders = [
        {
            id: '1',
            symbol: 'BTC/USDT',
            side: 'long' as const,
            type: 'Limit',
            price: '42,150.00',
            amount: '0.05 BTC',
            filled: '0%',
            time: '2026-01-30 14:20:15'
        }
    ];

    const mockPositions = [
        {
            id: '1',
            symbol: token?.symbol || 'BTC',
            side: 'long' as const,
            leverage: '10X',
            marginMode: 'Cross',
            unrealizedPnl: '+$1,850.50',
            roi: '+52.50%',
            value: '5,015.09',
            margin: '100',
            risk: '2.34%',
            entryPrice: '0.0249',
            markPrice: '0.0259',
            liqPrice: '0.0215',
            isPositive: true
        }
    ];

    if (!token) {
        return (
            <View style={styles.container}>
                <CustomStatusBar />
                <View style={[styles.center, { paddingTop: top }]}>
                    <Text style={styles.loadingText}>Loading {symbol}...</Text>
                </View>
            </View>
        );
    }

    const { formatted: changeText, isPositive } = formatPercentageChange(token.priceChange24h || 0);

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            {/* 1. Header Navigation: Design 3279:116115 */}
            <View style={[styles.header, { paddingTop: 0 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Image
                        source={require('@/assets/settings/arrow-left-02.svg')}
                        style={styles.headerIcon}
                    />
                </TouchableOpacity>

                <View style={styles.navTabs}>
                    <Pressable onPress={() => { }}>
                        <Text style={styles.navTabText}>Spot</Text>
                    </Pressable>
                    <View style={styles.navTabActiveWrapper}>
                        <Text style={styles.navTabActiveText}>Perp</Text>
                    </View>
                </View>

                {/* Placeholder for symmetry / other action */}
                <View style={[styles.headerBtn, { opacity: 0 }]} />
            </View>

            {/* 2. Asset Summary Row: Design 3279:116131 */}
            <View style={styles.assetSummary}>
                <View style={styles.tokenSection}>
                    <Image source={token.logoURI} style={styles.tokenLogo} />
                    <View>
                        <Text style={styles.tokenText}>
                            {token.symbol}<Text style={styles.quoteText}>/USDT</Text>
                        </Text>
                        <Text style={[styles.changeText, { color: isPositive ? colors.success : colors.error }]}>
                            {isPositive ? '+' : ''}{changeText}
                        </Text>
                    </View>
                </View>

                <View style={styles.chartButtons}>
                    <TouchableOpacity style={styles.chartBtn}>
                        <Image source={require('@/assets/market/chart-line-data-02.svg')} style={styles.chartIcon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.chartBtn, styles.chartBtnActive]}>
                        <Image source={require('@/assets/market/chart-01.svg')} style={[styles.chartIcon, { tintColor: '#FFF' }]} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottom + 100 }}
            >
                {/* 4. Main Trading Interface: Layout Right/Left aligned to Figma */}
                <View style={styles.tradeLayout}>
                    {/* LEFT: FORM */}
                    <View style={styles.formCol}>
                        <PerpTradeForm
                            symbol={token.symbol}
                            availableBalance={usdtBalance}
                            initialSide={side}
                        />
                    </View>

                    {/* RIGHT: ORDER BOOK */}
                    <View style={styles.bookCol}>
                        <PerpOrderBook />
                    </View>
                </View>

                {/* 5. Bottom Tabs: Design 3279:116085 */}
                <View style={styles.positionsSection}>
                    <View style={styles.tabsHeader}>
                        <View style={styles.tabLinks}>
                            <TouchableOpacity
                                style={[styles.tabLink, activeTab === 'Orders' && styles.tabLinkActive]}
                                onPress={() => setActiveTab('Orders')}
                            >
                                <Text style={[styles.tabText, activeTab === 'Orders' && styles.tabTextActive]}>
                                    Orders ({mockOrders.length})
                                </Text>
                                {activeTab === 'Orders' && <View style={styles.tabIndicator} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabLink, activeTab === 'Positions' && styles.tabLinkActive]}
                                onPress={() => setActiveTab('Positions')}
                            >
                                <Text style={[styles.tabText, activeTab === 'Positions' && styles.tabTextActive]}>
                                    Positions ({mockPositions.length})
                                </Text>
                                {activeTab === 'Positions' && <View style={styles.tabIndicator} />}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity>
                            <Image
                                source={require('@/assets/home/transaction-history.svg')}
                                style={styles.historyIcon}
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tabContentArea}>
                        {activeTab === 'Orders' ? (
                            mockOrders.length > 0 ? (
                                <View style={styles.listContainer}>
                                    {mockOrders.map(order => (
                                        <OrderItem key={order.id} {...order} onCancel={() => { }} />
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyStateContainer}>
                                    <Image
                                        source={require('@/assets/settings/unavailable.svg')}
                                        style={styles.emptyImg}
                                    />
                                    <Text style={styles.emptyMessage}>No Available Orders</Text>
                                </View>
                            )
                        ) : (
                            mockPositions.length > 0 ? (
                                <View style={styles.listContainer}>
                                    {mockPositions.map(pos => (
                                        <PositionItem key={pos.id} {...pos} />
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyStateContainer}>
                                    <Image
                                        source={require('@/assets/settings/unavailable.svg')}
                                        style={styles.emptyImg}
                                    />
                                    <Text style={styles.emptyMessage}>No Available Positions</Text>
                                </View>
                            )
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* 6. Sticky Bottom Action UI: Design 3279:115892 */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 60,
    },
    headerBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
    },
    headerIcon: {
        width: 24,
        height: 24,
        tintColor: colors.titleText,
    },
    navTabs: {
        flexDirection: 'row',
        gap: 24,
        justifyContent: "flex-start",
        alignItems: "center",
        flex: 1,
    },
    navTabText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.mutedText,
    },
    navTabActiveWrapper: {
        paddingBottom: 2,
    },
    navTabActiveText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    assetSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginVertical: 12,
    },
    tokenSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    tokenLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    tokenText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
    },
    quoteText: {
        color: colors.mutedText,
    },
    changeText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 13,
    },
    chartButtons: {
        flexDirection: 'row',
        backgroundColor: colors.bgSemi,
        borderRadius: 10,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    chartBtn: {
        width: 32,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    chartBtnActive: {
        backgroundColor: colors.bgStroke,
    },
    chartIcon: {
        width: 16,
        height: 16,
        tintColor: colors.mutedText,
    },
    marketStats: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 20,
        marginBottom: 16,
    },
    statBox: {
        gap: 4,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    statValue: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.titleText,
    },
    tradeLayout: {
        flexDirection: 'row',
        paddingHorizontal: 12,
    },
    formCol: {
        flex: 0.58,
        paddingRight: 6,
    },
    bookCol: {
        flex: 0.42,
        paddingLeft: 6,
    },
    positionsSection: {
        marginTop: 24,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    tabsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    tabLinks: {
        flexDirection: 'row',
        gap: 28,
    },
    tabLink: {
        paddingVertical: 16,
        position: 'relative',
    },
    tabLinkActive: {},
    tabText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.mutedText,
    },
    tabTextActive: {
        color: colors.titleText,
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: colors.titleText,
    },
    historyIcon: {
        width: 20,
        height: 20,
        tintColor: colors.mutedText,
    },
    tabContentArea: {
        minHeight: 150,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    listContainer: {
        width: '100%',
    },
    emptyStateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        opacity: 0.6,
        paddingVertical: 40,
    },
    emptyImg: {
        width: 32,
        height: 32,
    },
    emptyMessage: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: colors.mutedText,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.bg,
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 16,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
    },
    footerBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerBtnText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.bodyText,
        fontSize: 16,
    },
});
