import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { TradingPair } from '@/types';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MarketSectionProps {
    pairs: TradingPair[];
    isLoading?: boolean;
}

const tabs = [
    { id: 'favourite', label: 'Favourite' },
    { id: 'top', label: 'Top' },
    // { id: 'spotlight', label: 'Spotlight' },
    { id: 'new', label: 'New' },
    { id: 'gainers', label: 'Gainers' },
    { id: 'losers', label: 'Losers' },
];

/**
 * Market Section
 * Tabbed interface with trading pairs list
 * Matches Figma design exactly
 */
export const MarketSection: React.FC<MarketSectionProps> = ({
    pairs,
    isLoading = false,
}) => {
    const [activeTab, setActiveTab] = useState('top');

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Skeleton width={54} height={22} borderRadius={4} />
                <View style={styles.loadingTabs}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
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

    const getChangeColor = (change: number) => {
        return change >= 0 ? colors.success : colors.error;
    };

    const formatChange = (change: number) => {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Market</Text>
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
                                onPress={() => setActiveTab(tab.id)}
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

            {/* Trading Pairs List */}
            <View style={styles.listContainer}>
                {pairs.map((pair) => (
                    <TouchableOpacity
                        key={pair.id}
                        style={styles.pairItem}
                        activeOpacity={0.7}
                    >
                        {/* Logo */}
                        <Image
                            source={pair.logo}
                            style={styles.pairLogo}
                            contentFit="cover"
                        />

                        {/* Info */}
                        <View style={styles.pairInfo}>
                            <View style={styles.symbolRow}>
                                <Text style={styles.baseSymbol}>{pair.baseSymbol}</Text>
                                <Text style={styles.quoteSymbol}>/{pair.quoteSymbol}</Text>
                                <View style={styles.leverageBadge}>
                                    <Text style={styles.leverageText}>{pair.leverage}</Text>
                                </View>
                            </View>
                            <Text style={styles.volumeText}>{pair.volume}</Text>
                        </View>

                        {/* Price and Change */}
                        <View style={styles.priceContainer}>
                            <Text style={styles.priceText}>{pair.price}</Text>
                            <Text
                                style={[
                                    styles.changeText,
                                    { color: getChangeColor(pair.change24h) }
                                ]}
                            >
                                {formatChange(pair.change24h)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {/* View All Button */}
                <TouchableOpacity
                    style={styles.viewAllButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.viewAllText}>View all</Text>
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
        width: 353,
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
        gap: 6,
    },
    baseSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
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
