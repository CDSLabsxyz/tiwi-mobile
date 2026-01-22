import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { DexMarket } from '@/types';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SmartMarketsSectionProps {
    markets: DexMarket[];
    isLoading?: boolean;
}

export const SmartMarketsSection: React.FC<SmartMarketsSectionProps> = ({
    markets,
    isLoading = false,
}) => {
    if (isLoading) {
        return (
            <View style={styles.container}>
                <Skeleton width={112} height={22} borderRadius={4} />
                <View style={styles.skeletonGrid}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} width={110} height={38} borderRadius={100} />
                    ))}
                </View>
            </View>
        );
    }

    const firstRow = markets.slice(0, 5);
    const secondRow = markets.slice(5);

    const renderMarket = (market: DexMarket) => (
        <TouchableOpacity key={market.id} style={styles.marketButton} activeOpacity={0.7}>
            <Image source={market.logo} style={styles.marketLogo} contentFit="cover" />
            <Text style={styles.marketName}>{market.name}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Smart Markets</Text>

            <View style={styles.grid}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                    {firstRow.map(renderMarket)}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                    {secondRow.map(renderMarket)}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        gap: 8,
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    grid: {
        gap: 8,
    },
    row: {
        gap: 8,
    },
    marketButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    marketLogo: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    marketName: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    skeletonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
});
