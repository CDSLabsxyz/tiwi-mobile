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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Spotlight</Text>
                <TouchableOpacity>
                    <Image
                        source={require('../../../assets/home/arrow-right-01.svg')}
                        style={styles.arrowIcon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
            >
                {tokens.map((token) => (
                    <View key={token.id} style={styles.card}>
                        <Image
                            source={token.logo}
                            style={styles.tokenLogo}
                            contentFit="cover"
                        />
                        <View>
                            <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                            <Text style={[styles.tokenChange, { color: token.change24h >= 0 ? colors.success : colors.error }]}>
                                {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
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
        gap: 8,
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
    arrowIcon: {
        width: 16,
        height: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    tokenLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
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
