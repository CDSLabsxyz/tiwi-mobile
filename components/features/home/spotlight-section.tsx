import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { SpotlightToken } from '@/types';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SpotlightSectionProps {
    tokens: SpotlightToken[];
    isLoading?: boolean;
}

/**
 * Spotlight Section
 * Horizontal scrollable crypto cards
 * Matches Figma design exactly
 */
export const SpotlightSection: React.FC<SpotlightSectionProps> = ({
    tokens,
    isLoading = false,
}) => {
    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Skeleton width={72} height={22} borderRadius={4} />
                    <Skeleton width={16} height={16} borderRadius={4} />
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} width={100} height={51} borderRadius={100} />
                    ))}
                </ScrollView>
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
                <Text style={styles.title}>Spotlight</Text>
                <TouchableOpacity activeOpacity={0.7}>
                    <Image
                        source={require('../../../assets/home/arrow-right-01.svg')}
                        style={styles.headerIcon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
            </View>

            {/* Scrollable Cards */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {tokens.map((token) => (
                    <View key={token.id} style={styles.card}>
                        <Image
                            source={token.logo}
                            style={styles.tokenLogo}
                            contentFit="cover"
                        />
                        <View style={styles.tokenInfo}>
                            <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                            <Text
                                style={[
                                    styles.tokenChange,
                                    { color: getChangeColor(token.change24h) }
                                ]}
                            >
                                {formatChange(token.change24h)}
                            </Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 353,
        gap: 8, // matches gap-2 in tailwind (8px)
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    headerIcon: {
        width: 16,
        height: 16,
    },
    scrollContent: {
        gap: 6,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8, // matches gap-2 in tailwind
        paddingLeft: 8, // matches pl-2 in tailwind
        paddingRight: 16, // matches pr-4 in tailwind
        paddingVertical: 8, // matches py-2 in tailwind
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    tokenLogo: {
        width: 32, // matches w-8 (32px)
        height: 32, // matches h-8 (32px)
        borderRadius: 16,
    },
    tokenInfo: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    tokenSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    tokenChange: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
    },
});
