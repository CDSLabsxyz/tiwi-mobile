import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Activities Screen
 * Displays user transactions and protocol interactions.
 * Currently a skeleton implementation.
 */
export default function ActivitiesScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();
    const [activeFilter, setActiveFilter] = useState('All');

    const filters = ['All', 'Transactions', 'DeFi', 'NFTs'];

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)' as any);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top + 16 }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Image
                        source={require('@/assets/swap/arrow-left-02.svg')}
                        style={styles.backIcon}
                        contentFit="contain"
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Activities</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Filters */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {filters.map(filter => (
                        <TouchableOpacity
                            key={filter}
                            onPress={() => setActiveFilter(filter)}
                            style={[
                                styles.filterChip,
                                activeFilter === filter && styles.activeFilterChip
                            ]}
                        >
                            <Text style={[
                                styles.filterText,
                                activeFilter === filter && styles.activeFilterText
                            ]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Activity List Skeleton */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: bottom + 24 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                        <Image
                            source={require('@/assets/home/transaction-history.svg')}
                            style={styles.emptyIcon}
                            contentFit="contain"
                        />
                    </View>
                    <Text style={styles.emptyTitle}>No activities yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Your transactions and protocol interactions will appear here once you start using Tiwi.
                    </Text>

                    <TouchableOpacity
                        style={styles.exploreButton}
                        onPress={() => router.replace('/(tabs)' as any)}
                    >
                        <Text style={styles.exploreButtonText}>Explore Protocol</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.bgCards,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    backIcon: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
    },
    placeholder: {
        width: 40,
    },
    filterContainer: {
        marginVertical: 16,
    },
    filterScroll: {
        paddingHorizontal: 20,
        gap: 12,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    activeFilterChip: {
        backgroundColor: colors.primaryCTA,
        borderColor: colors.primaryCTA,
    },
    filterText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.mutedText,
    },
    activeFilterText: {
        color: '#000000',
    },
    content: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingTop: 80,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.bgCards,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyIcon: {
        width: 40,
        height: 40,
        opacity: 0.5,
    },
    emptyTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: colors.titleText,
        marginBottom: 12,
    },
    emptySubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    exploreButton: {
        backgroundColor: colors.primaryCTA,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 100,
    },
    exploreButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#000000',
    },
});
