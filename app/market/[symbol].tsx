/**
 * Market Detail (Spot) Screen
 * Implements spot trading detail view for a selected pair using new SDK hooks.
 */

import { TradingViewChart } from '@/components/features/market/detail/TradingViewChart';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { useTokenDetail } from '@/hooks/useTokenDetail';
import { useEnrichedMarketDetail } from '@/hooks/useEnrichedMarketDetail';
import { formatCompactNumber } from '@/utils/formatting';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icons using local assets
const BackIcon = require('../../assets/swap/arrow-left-02.svg');
const StarIcon = require('../../assets/home/star-18.svg');
const ShareIcon = require('../../assets/wallet/share-08.svg');
const ChartLineIcon = require('../../assets/home/market-analysis.svg');
const CopyIcon = require('../../assets/wallet/copy-01.svg');
const LinkIcon = require('../../assets/home/arrow-right-01.svg');

export default function MarketDetailScreen() {
    const router = useRouter();
    const { symbol, address, chainId } = useLocalSearchParams<{
        symbol: string;
        address?: string;
        chainId?: string;
    }>();
    const { top, bottom } = useSafeAreaInsets();

    const { data: tokenDetail, isLoading: isLoadingDetail } = useTokenDetail({
        address: address,
        chainId: chainId ? parseInt(chainId) : undefined,
        symbol: symbol,
    });

    const { data: marketDetail, isLoading: isLoadingMarket } = useEnrichedMarketDetail({
        symbol: symbol || '',
        address: address,
        chainId: chainId ? parseInt(chainId) : undefined,
    });

    const isLoading = isLoadingDetail || isLoadingMarket;
    const token = tokenDetail || marketDetail;

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }]}>
                <CustomStatusBar />
                <TIWILoader size={80} />
                <Text style={styles.loadingText}>FETCHING MARKET DATA...</Text>
            </View>
        );
    }

    if (!token) {
        return (
            <View style={[styles.container, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }]}>
                <CustomStatusBar />
                <Text style={styles.errorText}>Market data not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const price = token.priceUSD ? `$${parseFloat(token.priceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00';
    const priceChange = token.priceChange24h || 0;
    const isPositive = priceChange >= 0;

    const aboutItems = [
        { label: 'Token Name', value: token.name || 'Unknown' },
        { label: 'Symbol', value: token.symbol || symbol },
        { label: 'Network', value: token.chainName || (chainId === '56' ? 'BNB' : 'Chain ' + chainId) },
        { label: 'Contract', value: token.address ? `${token.address.slice(0, 6)}...${token.address.slice(-4)}` : 'N/A', copyable: !!token.address, fullValue: token.address },
        { label: 'Official X', value: token.socials?.twitter || 'N/A', linkable: !!token.socials?.twitter },
        { label: 'Website', value: token.socials?.website || 'N/A', linkable: !!token.socials?.website },
    ];

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
                            {token.logoURI || token.logo ? (
                                <Image source={{ uri: token.logoURI || token.logo }} style={styles.tokenIcon} contentFit="contain" />
                            ) : (
                                <View style={styles.tokenIconPlaceholder} />
                            )}
                            <Text style={styles.tokenSymbol}>
                                {token.symbol || symbol}
                                <Text style={{ color: colors.bodyText }}>/USD</Text>
                            </Text>
                        </View>

                        <View style={styles.modeToggle}>
                            <View style={styles.modeActive}>
                                <Image source={ChartLineIcon} style={styles.microIcon} contentFit="contain" />
                            </View>
                        </View>
                    </View>

                    <View style={{ marginTop: 8 }}>
                        <Text style={styles.price}>{price}</Text>
                        <View style={styles.priceChangeRow}>
                            <Text style={[styles.priceChange, { color: isPositive ? colors.success : colors.error }]}>
                                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                            </Text>
                            <Text style={styles.timeframeLabel}>24h</Text>
                        </View>
                    </View>
                </View>

                {/* Live TradingView Chart */}
                <View style={styles.chartWrapper}>
                    <TradingViewChart
                        symbol={token.symbol || symbol}
                        baseAddress={token.address}
                        chainId={token.chainId}
                        provider="onchain"
                        price={parseFloat(token.priceUSD || '0')}
                    />
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Market Cap</Text>
                        <Text style={styles.statValue}>{token.marketCap ? `$${formatCompactNumber(token.marketCap)}` : 'N/A'}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Liquidity</Text>
                        <Text style={styles.statValue}>{token.liquidity ? `$${formatCompactNumber(token.liquidity)}` : 'N/A'}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>24h Volume</Text>
                        <Text style={styles.statValue}>{token.volume24h ? `$${formatCompactNumber(token.volume24h)}` : 'N/A'}</Text>
                    </View>
                </View>

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
                                <Text style={styles.infoValue} numberOfLines={1}>{item.value}</Text>
                                {item.copyable && (
                                    <TouchableOpacity onPress={() => Alert.alert('Copied', item.fullValue)} style={styles.microButton}>
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

                {/* Supply Info */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Token Supply</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Circulating Supply</Text>
                        <Text style={styles.infoValue}>{token.circulatingSupply ? formatCompactNumber(token.circulatingSupply) : 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Total Supply</Text>
                        <Text style={styles.infoValue}>{token.totalSupply ? formatCompactNumber(token.totalSupply) : 'N/A'}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Buy/Sell Bar */}
            <View style={styles.actionBar}>
                <TouchableOpacity
                    onPress={() => router.push({ pathname: '/swap', params: { symbol: token.symbol, assetId: token.address, chainId: token.chainId } })}
                    activeOpacity={0.9}
                    style={[styles.actionButton, styles.buyButton]}
                >
                    <Text style={[styles.actionButtonText, { color: colors.bg }]}>Swap</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => Alert.alert('Trade', 'Futures trading is coming soon')}
                    activeOpacity={0.9}
                    style={[styles.actionButton, styles.sellButton]}
                >
                    <Text style={[styles.actionButtonText, { color: colors.titleText }]}>Trade</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    iconButton: { width: 24, height: 24 },
    icon: { width: '100%', height: '100%' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    smallIcon: { width: 20, height: 20 },
    pairInfoContainer: { paddingHorizontal: 20, paddingVertical: 8 },
    pairHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tokenIdentifier: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tokenIcon: { width: 32, height: 32, borderRadius: 16 },
    tokenIconPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgCards },
    tokenSymbol: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: colors.titleText },
    modeToggle: {
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 100,
        flexDirection: 'row',
        alignItems: 'center',
    },
    modeActive: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, backgroundColor: colors.bgStroke },
    microIcon: { width: 16, height: 16 },
    price: { fontFamily: 'Manrope-SemiBold', fontSize: 32, color: colors.titleText, marginTop: 4 },
    priceChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    priceChange: { fontFamily: 'Manrope-SemiBold', fontSize: 14 },
    timeframeLabel: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.bodyText },
    chartWrapper: { width: '100%', height: 380, marginTop: 10 },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: 20,
        gap: 10
    },
    statBox: {
        flex: 1,
        backgroundColor: colors.bgSemi,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke
    },
    statLabel: { fontFamily: 'Manrope-Medium', fontSize: 10, color: colors.bodyText, marginBottom: 4 },
    statValue: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: colors.titleText },
    sectionContainer: { paddingHorizontal: 20, paddingVertical: 12, gap: 10 },
    sectionTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: colors.titleText, marginBottom: 2 },
    positionCard: { borderTopWidth: 1, borderTopColor: colors.bgStroke, paddingTop: 12, alignItems: 'center', gap: 12 },
    noDataText: { fontFamily: 'Manrope-Medium', fontSize: 12, color: colors.bodyText },
    infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
    infoLabel: { fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.bodyText },
    infoValueContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '60%' },
    infoValue: { fontFamily: 'Manrope-Medium', fontSize: 14, color: colors.titleText },
    microButton: { width: 16, height: 16 },
    actionBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row',
        gap: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.bg,
        borderTopWidth: 0.5, borderTopColor: colors.bgStroke,
    },
    actionButton: { flex: 1, height: 52, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    buyButton: { backgroundColor: colors.primaryCTA },
    sellButton: { backgroundColor: colors.bgSemi, borderWidth: 1, borderColor: colors.bgStroke },
    actionButtonText: { fontFamily: 'Manrope-SemiBold', fontSize: 16 },
    loadingText: { color: colors.primaryCTA, marginTop: 16, fontSize: 10, fontWeight: 'bold' },
    errorText: { color: colors.error, fontSize: 16, fontFamily: 'Manrope-Medium' },
    backButton: { marginTop: 20, padding: 10 },
    backButtonText: { color: colors.primaryCTA, fontFamily: 'Manrope-SemiBold' }
});

