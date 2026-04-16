import { ActivitiesFilterSheet } from '@/components/sections/Wallet/ActivitiesFilterSheet';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { UnifiedActivity, useUnifiedActivities } from '@/hooks/useUnifiedActivities';
import { useWalletStore } from '@/store/walletStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Activities Screen
 * Displays unified history from Global Tiwi Transactions and local Supabase activities.
 * Matches Figma design exactly as per user image.
 */
export default function ActivitiesScreen() {
    const router = useRouter();
    const { top, bottom } = useSafeAreaInsets();
    const { activeAddress } = useWalletStore();

    const [activeFilter, setActiveFilter] = useState('All');
    const [isFilterVisible, setIsFilterVisible] = useState(false);

    const { data: activities = [], isLoading, refetch, isRefetching } = useUnifiedActivities(100);

    const filteredActivities = useMemo(() => {
        if (activeFilter === 'All') return activities;
        return activities.filter(a => {
            const cat = (a.category || '').toLowerCase();
            const type = (a.type || '').toLowerCase();
            const title = (a.title || '').toLowerCase();

            switch (activeFilter) {
                case 'Swap':
                    return cat === 'swap' || title.includes('swapped');
                case 'Staking':
                    return cat === 'stake' || cat === 'unstake' || title.includes('stake');
                case 'Transfers':
                    return cat === 'sent' || cat === 'received' || cat === 'transfer';
                case 'Approve':
                    return cat === 'approve' || title.includes('approve');
                case 'Contract':
                    return cat === 'contractcall' || type === 'contract';
                case 'DeFi':
                    return cat === 'defi' || type === 'defi';
                case 'Mint':
                    return cat === 'mint' || title.includes('mint');
                case 'NFT_Transfer':
                    return (cat === 'transfer' || type === 'nft') && (title.includes('nft') || cat.includes('nft'));
                case 'Market':
                    return cat === 'sale' || cat === 'purchase' || title.includes('sold') || title.includes('bought');
                case 'Listing':
                    return cat === 'listing' || cat === 'unlisting';
                default:
                    return true;
            }
        });
    }, [activities, activeFilter]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)' as any);
        }
    };

    const formatAddress = (addr: string | null) => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`.toUpperCase();
    };

    const getExplorerUrl = (hash: string, chainId?: number) => {
        const explorers: Record<number, string> = {
            1: 'https://etherscan.io/tx/',
            56: 'https://bscscan.com/tx/',
            137: 'https://polygonscan.com/tx/',
            8453: 'https://basescan.org/tx/',
            10: 'https://optimistic.etherscan.io/tx/',
            43114: 'https://snowtrace.io/tx/',
            42161: 'https://arbiscan.io/tx/',
        };
        const base = explorers[chainId || 56] || explorers[56];
        return `${base}${hash}`;
    };

    const renderActivityItem = ({ item }: { item: UnifiedActivity }) => {
        const isReceived = item.category === 'Received' || item.title.toLowerCase().includes('received');
        const amountColor = isReceived ? '#498F00' : colors.titleText;

        return (
            <TouchableOpacity
                style={styles.activityItem}
                activeOpacity={0.7}
                onPress={() => {
                    if (item.hash) {
                        const url = getExplorerUrl(item.hash, item.chainId);
                        router.push({ pathname: '/browser', params: { url } });
                    }
                }}
            >
                {/* Left Side: Type and Date */}
                <View style={styles.leftContent}>
                    <Text style={styles.activityLabel}>{item.category || item.type}</Text>
                    <Text style={styles.activityDate}>{item.date}</Text>
                </View>

                {/* Right Side: Amount and USD Value */}
                <View style={styles.rightContent}>
                    <Text style={[styles.activityAmount, { color: amountColor }]}>
                        {item.amount || '0'} {item.tokenSymbol || ''}
                    </Text>
                    <Text style={styles.activityUsd}>{item.usdValue || '$0.00'}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Header Area */}
            <View style={[styles.headerContainer, { paddingTop: top + 10 }]}>
                <View style={styles.headerTopRow}>
                    <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
                        <Image
                            source={require('@/assets/swap/arrow-left-02.svg')}
                            style={styles.headerIcon}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    {/* Address Pill */}
                    <View style={styles.addressPill}>
                        <Text style={styles.addressText}>{formatAddress(activeAddress)}</Text>
                    </View>

                    <TouchableOpacity onPress={() => setIsFilterVisible(true)} style={styles.iconButton}>
                        <Image
                            source={require('@/assets/wallet/filter-horizontal.svg')}
                            style={styles.headerIcon}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                </View>

                <Text style={styles.headerTitle}>Activities</Text>
            </View>

            {/* Activity List */}
            <FlatList
                data={filteredActivities}
                keyExtractor={(item) => item.id}
                renderItem={renderActivityItem}
                contentContainerStyle={[styles.listContent, { paddingBottom: bottom + 24 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primaryCTA}
                    />
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>No activities found</Text>
                            <Text style={styles.emptySubtitle}>
                                {activeFilter === 'All'
                                    ? "Your transactions and protocol interactions will appear here."
                                    : `No activities found for ${activeFilter}.`}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>Loading history...</Text>
                        </View>
                    )
                }
            />

            <ActivitiesFilterSheet
                visible={isFilterVisible}
                onClose={() => setIsFilterVisible(false)}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        paddingHorizontal: 20,
        paddingBottom: 24,
        alignItems: 'center',
        gap: 20,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIcon: {
        width: 24,
        height: 24,
    },
    addressPill: {
        backgroundColor: '#1B1B1B',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
    },
    addressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
        letterSpacing: 0.5,
    },
    headerTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 24,
        color: colors.titleText,
    },
    listContent: {
        paddingHorizontal: 20,
    },
    activityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 14,
        // Remove border/background to match image exactly
    },
    leftContent: {
        gap: 4,
    },
    rightContent: {
        alignItems: 'flex-end',
        gap: 4,
    },
    activityLabel: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    activityDate: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    activityAmount: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.titleText,
    },
    activityUsd: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingTop: 40,
    },
    loadingText: {
        fontFamily: 'Manrope-Medium',
        color: colors.mutedText,
    }
});
