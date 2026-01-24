/**
 * Market Detail (Spot) Screen
 * Implements spot trading detail view for a selected pair
 * Matches Figma references (spot trade / detail states)
 */

import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { fetchMarketData } from '@/services/marketService';
import { MarketToken } from '@/types/market';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icons using local assets
const BackIcon = require('../../assets/swap/arrow-left-02.svg');
const StarIcon = require('../../assets/home/star-18.svg');
const ShareIcon = require('../../assets/wallet/share-08.svg');
const ChartLineIcon = require('../../assets/home/market-analysis.svg'); // Fallback to market analysis icon
// const ChartCandleIcon = require('@/assets/market/chart-01.svg'); // Missing asset, need fallback or find similar

// Chart placeholder from Figma
const ChartImage = 'https://www.figma.com/api/mcp/asset/c40f42b6-3f01-47ad-a71f-43d9d27355d4';

// Info icons
const CopyIcon = require('../../assets/wallet/copy-01.svg');
const LinkIcon = require('../../assets/home/arrow-right-01.svg'); // Using arrow right as generic link icon for now

const timeframes = ['15m', '1h', '4h', '6h', '1D', '3D', 'More'];

const aboutItems = [
    { label: 'Token Name', value: 'Zora' },
    { label: 'Network', value: 'Base' },
    { label: 'Contract', value: '0x1111...fc69', copyable: true },
    { label: 'Official X', value: '@zora', linkable: true },
    { label: 'Website', value: 'zora.co', linkable: true },
];

const statsTop = [
    { label: 'Market Cap', value: '$520.98M' },
    { label: 'Liquidity', value: '$2.08T' },
    { label: '24h Volume', value: '$9.55M' },
];

const supplies = [
    { label: 'Circulating Supply', value: '4,469,999,998' },
    { label: 'Total Supply', value: '10,000,000,000' },
    { label: 'Max. Supply', value: '10,000,000,000' },
];

export default function MarketDetailScreen() {
    const router = useRouter();
    const { symbol } = useLocalSearchParams<{ symbol: string }>();
    const { top, bottom } = useSafeAreaInsets();

    // Load data (mocked for now)
    const [marketData, setMarketData] = React.useState<{ spot: MarketToken[]; perp: MarketToken[] }>({
        spot: [],
        perp: [],
    });

    React.useEffect(() => {
        const load = async () => {
            const data = await fetchMarketData();
            setMarketData(data);
        };
        load();
    }, []);

    const token = useMemo(() => {
        if (!symbol) return null;
        const lower = symbol.toLowerCase();
        return marketData.spot.find((t) => t.symbol.toLowerCase() === lower) || marketData.perp.find((t) => t.symbol.toLowerCase() === lower) || null;
    }, [symbol, marketData]);

    const price = token?.price ?? '$0.05189';
    const priceChange = token?.priceChange ?? 1.13;
    const priceChangeText = token?.priceChangePercent ?? '+$1.13%';
    const isPositive = priceChange >= 0;

    const handleCopy = (text: string) => {
        Alert.alert('Copied', text);
    };

    const handleBuy = () => {
        Alert.alert('Buy', 'Buy flow coming soon');
    };

    const handleSell = () => {
        Alert.alert('Sell', 'Sell flow coming soon');
    };

    if (!token) {
        return (
            <View style={[styles.container, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }]}>
                <CustomStatusBar />
                <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 16, color: colors.bodyText }}>Loading pair...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header */}
            <View style={{ paddingTop: top, backgroundColor: colors.bg }}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.iconButton}>
                        <Image source={BackIcon} style={styles.icon} contentFit="contain" />
                    </TouchableOpacity>

                    <View style={styles.headerRight}>
                        <Image source={StarIcon} style={styles.smallIcon} contentFit="contain" />
                        <Image source={ShareIcon} style={styles.smallIcon} contentFit="contain" />
                    </View>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottom + 96 }}
            >
                {/* Pair + Price */}
                <View style={styles.pairInfoContainer}>
                    <View style={styles.pairHeader}>
                        <View style={styles.tokenIdentifier}>
                            <View style={styles.tokenIconPlaceholder} />
                            <Text style={styles.tokenSymbol}>
                                {token.symbol}
                                <Text style={{ color: colors.bodyText }}>/USDT</Text>
                            </Text>
                        </View>

                        <View style={styles.modeToggle}>
                            <View style={styles.modeActive}>
                                <Image source={ChartLineIcon} style={styles.microIcon} contentFit="contain" />
                            </View>
                            {/* Added placeholder for candle chart icon if we find one 
              <TouchableOpacity style={styles.modeInactive}>
                 <Image source={ChartCandleIcon} style={styles.microIcon} contentFit="contain" />
              </TouchableOpacity>
              */}
                        </View>
                    </View>

                    <View style={{ marginTop: 8 }}>
                        <Text style={styles.price}>{price}</Text>
                        <View style={styles.priceChangeRow}>
                            <Text style={[styles.priceChange, { color: isPositive ? colors.success : colors.error }]}>
                                {priceChangeText}
                            </Text>
                            <Text style={styles.timeframeLabel}>1D</Text>
                        </View>
                    </View>
                </View>

                {/* Chart */}
                <View style={styles.chartContainer}>
                    <Image source={{ uri: ChartImage }} style={styles.chartImage} contentFit="cover" />
                </View>

                {/* Timeframes */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timeframesContainer}
                >
                    {timeframes.map((tf) => (
                        <TouchableOpacity key={tf} activeOpacity={0.8}>
                            <Text
                                style={[
                                    styles.timeframeText,
                                    {
                                        fontFamily: tf === '1D' ? 'Manrope-SemiBold' : 'Manrope-Medium',
                                        color: tf === '1D' ? colors.titleText : colors.bodyText
                                    }
                                ]}
                            >
                                {tf}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Your Position */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Your Position</Text>
                    <View style={styles.positionCard}>
                        <Text style={styles.noDataText}>No Available Data</Text>
                    </View>
                </View>

                {/* About */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>About</Text>
                    {aboutItems.map((item) => (
                        <View key={item.label} style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{item.label}</Text>
                            <View style={styles.infoValueContainer}>
                                <Text style={styles.infoValue}>{item.value}</Text>
                                {item.copyable && (
                                    <TouchableOpacity onPress={() => handleCopy(item.value)} style={styles.microButton}>
                                        <Image source={CopyIcon} style={styles.microIcon} contentFit="contain" />
                                    </TouchableOpacity>
                                )}
                                {item.linkable && (
                                    <Image source={LinkIcon} style={styles.microIcon} contentFit="contain" />
                                )}
                            </View>
                        </View>
                    ))}
                </View>

                {/* Stats */}
                <View style={styles.sectionContainer}>
                    {statsTop.map((stat) => (
                        <View key={stat.label} style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{stat.label}</Text>
                            <Text style={styles.infoValue}>{stat.value}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.sectionContainer}>
                    {supplies.map((stat) => (
                        <View key={stat.label} style={styles.infoRow}>
                            <Text style={styles.infoLabel}>{stat.label}</Text>
                            <Text style={styles.infoValue}>{stat.value}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Buy/Sell Bar */}
            <View style={styles.actionBar}>
                <TouchableOpacity onPress={handleBuy} activeOpacity={0.9} style={[styles.actionButton, styles.buyButton]}>
                    <Text style={[styles.actionButtonText, { color: colors.bg }]}>Buy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSell} activeOpacity={0.9} style={[styles.actionButton, styles.sellButton]}>
                    <Text style={[styles.actionButtonText, { color: colors.titleText }]}>Sell</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    iconButton: {
        width: 24,
        height: 24,
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    smallIcon: {
        width: 20,
        height: 20,
    },
    pairInfoContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    pairHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tokenIdentifier: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    tokenIconPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.bgCards,
    },
    tokenSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    modeToggle: {
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 100,
        flexDirection: 'row',
        alignItems: 'center',
    },
    modeActive: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 100,
        backgroundColor: colors.bgStroke,
    },
    modeInactive: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    microIcon: {
        width: 16,
        height: 16,
    },
    price: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 24,
        color: colors.titleText,
    },
    priceChangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    priceChange: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
    },
    timeframeLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    chartContainer: {
        width: '100%',
        height: 300,
        marginTop: 4,
    },
    chartImage: {
        width: '100%',
        height: '100%',
    },
    timeframesContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 16,
    },
    timeframeText: {
        fontSize: 12,
    },
    sectionContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 10,
    },
    sectionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
        marginBottom: 2,
    },
    positionCard: {
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
        paddingTop: 12,
        alignItems: 'center',
        gap: 12,
    },
    noDataText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    infoLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    infoValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoValue: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    microButton: {
        width: 16,
        height: 16,
    },
    actionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: colors.bg,
        borderTopWidth: 0.5,
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
    actionButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
    },
});
