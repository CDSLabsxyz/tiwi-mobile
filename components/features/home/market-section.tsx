import { SkeletonLoader } from '@/components/ui/skeleton-loader';
import { colors } from '@/constants/colors';
import { TradingPair } from '@/types';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MarketSectionProps {
    pairs: TradingPair[];
    isLoading?: boolean;
}

/**
 * Market Section Component
 * Displays top trading pairs with tabs for Gainers and Losers
 * Matches Figma design exactly
 */
export const MarketSection: React.FC<MarketSectionProps> = ({
    pairs,
    isLoading = false,
}) => {
    const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers');

    const filteredPairs = pairs; // In a real app, logic for filtering gainers/losers

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <SkeletonLoader width={100} height={24} borderRadius={4} />
                    <SkeletonLoader width={40} height={16} borderRadius={4} />
                </View>
                <View style={styles.list}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={styles.pairRowSkeleton}>
                            <View style={styles.pairInfoSkeleton}>
                                <SkeletonLoader width={32} height={32} borderRadius={16} />
                                <View style={{ gap: 4 }}>
                                    <SkeletonLoader width={60} height={16} borderRadius={4} />
                                    <SkeletonLoader width={40} height={12} borderRadius={4} />
                                </View>
                            </View>
                            <SkeletonLoader width={60} height={20} borderRadius={4} />
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    const renderPair = ({ item }: { item: TradingPair }) => {
        const isPositive = item.change24h >= 0;

        return (
            <View style={styles.pairRow}>
                <View style={styles.pairLeft}>
                    <Image source={item.logo} style={styles.tokenLogo} contentFit="contain" />
                    <View>
                        <Text style={styles.pairSymbol}>{item.baseSymbol}/{item.quoteSymbol}</Text>
                        <Text style={styles.leverage}>{item.leverage}</Text>
                    </View>
                </View>
                <View style={styles.pairRight}>
                    <Text style={styles.price}>{item.price}</Text>
                    <Text style={[styles.change, { color: isPositive ? colors.success : colors.error }]}>
                        {isPositive ? '+' : ''}{item.change24h}%
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.tabs}>
                    <TouchableOpacity onPress={() => setActiveTab('gainers')}>
                        <Text style={[styles.tabText, activeTab === 'gainers' && styles.activeTabText]}>Top Gainers</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('losers')}>
                        <Text style={[styles.tabText, activeTab === 'losers' && styles.activeTabText]}>Top Losers</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity>
                    <Text style={styles.viewMore}>See All</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {filteredPairs.slice(0, 3).map((pair) => (
                    <React.Fragment key={pair.id}>
                        {renderPair({ item: pair })}
                    </React.Fragment>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tabs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    tabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.mutedText,
    },
    activeTabText: {
        color: colors.titleText,
    },
    viewMore: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    list: {
        gap: 12,
    },
    pairRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    pairLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    tokenLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    pairSymbol: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
    },
    leverage: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    pairRight: {
        alignItems: 'flex-end',
    },
    price: {
        fontFamily: 'Manrope-Bold',
        fontSize: 14,
        color: colors.titleText,
    },
    change: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        marginTop: 2,
    },
    pairRowSkeleton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pairInfoSkeleton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
});
