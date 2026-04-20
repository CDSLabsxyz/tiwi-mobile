import { ReceiptViewerModal } from '@/components/sections/Send';
import { TransactionReceipt } from '@/components/sections/Send/TransactionReceiptCard';
import { ActivitiesFilterSheet } from '@/components/sections/Wallet/ActivitiesFilterSheet';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useResolvedReceivedAmounts } from '@/hooks/useResolvedReceivedAmounts';
import { UnifiedActivity, useUnifiedActivities } from '@/hooks/useUnifiedActivities';
import { useWalletStore } from '@/store/walletStore';
import { buildReceiptFromActivity } from '@/utils/buildReceiptFromActivity';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    const [viewingReceipt, setViewingReceipt] = useState<TransactionReceipt | null>(null);

    const { data: activities = [], isLoading, refetch, isRefetching } = useUnifiedActivities(100);
    const { data: chains } = useChains();

    // For Received rows whose stored amount is 0/missing, resolve the real
    // amount from the tx receipt on-chain. Results are cached by hash, so
    // the list re-renders in place as each row's resolver resolves without
    // hammering the RPC.
    const resolvedReceived = useResolvedReceivedAmounts(activities, activeAddress);

    const filteredActivities = useMemo(() => {
        const validActivities = activities.filter(a => {
            const cat = (a.category || '').toLowerCase();
            const title = (a.title || '').toLowerCase();
            const direction = cat === 'received' || cat === 'receive' || cat === 'swap'
                || title.includes('received') || title.includes('swapped')
                ? 'received' : (cat === 'sent' || cat === 'send' || cat === 'transfer' || title.includes('sent')) ? 'sent' : null;
            
            const key = a.hash && a.chainId && direction
                ? `${a.chainId}:${a.hash.toLowerCase()}:${direction}`
                : null;
            const onChain = key ? resolvedReceived[key] : null;

            const numericMatch = String(a.amount ?? '').match(/^\s*([0-9]+(?:\.[0-9]+)?)/);
            const storedNumeric = numericMatch ? numericMatch[1] : '';
            const storedNumericValue = storedNumeric ? parseFloat(storedNumeric) : 0;
            
            const isSwap = cat === 'swap' || title.includes('swapped');
            const useOnChain = !!onChain && (isSwap || !storedNumericValue);
            const rawAmount = useOnChain && onChain ? onChain.amount : (storedNumeric || '0');
            const displayAmtMatch = String(rawAmount).match(/^\s*([0-9]+(?:\.[0-9]+)?)/);
            const finalAmt = displayAmtMatch ? parseFloat(displayAmtMatch[1]) : 0;

            // If our resolver figures out this "swap" was actually a Send, 
            // the logger misclassified a purely outgoing tx. Drop it because the real 
            // "Sent" log from the same tx is already in the list.
            if (isSwap && onChain && onChain.resolvedDirection === 'sent') {
                return false;
            }

            // If it's effectively 0, hide it. 
            // - If it's a pending real Receive, it will disappear momentarily 
            //   and pop in as soon as onChain resolves it with the real amount.
            // - If it's a blank transaction with no value, it stays hidden forever.
            if (finalAmt === 0) {
                return false;
            }
            return true;
        });

        if (activeFilter === 'All') return validActivities;
        
        return validActivities.filter(a => {
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
    }, [activities, activeFilter, resolvedReceived]);

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
        const cat = (item.category || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const direction = cat === 'received' || cat === 'receive' || cat === 'swap'
            || title.includes('received') || title.includes('swapped')
            ? 'received'
            : (cat === 'sent' || cat === 'send' || cat === 'transfer' || title.includes('sent'))
                ? 'sent'
                : null;
        const key = item.hash && item.chainId && direction
            ? `${item.chainId}:${item.hash.toLowerCase()}:${direction}`
            : null;
        const onChain = key ? resolvedReceived[key] : null;

        // Numeric-prefix extraction — some loggers write "1000000", some
        // "1000000 TWC", some "1000000 TWC TWC". Collapse to the number.
        const numericMatch = String(item.amount ?? '').match(/^\s*([0-9]+(?:\.[0-9]+)?)/);
        const storedNumeric = numericMatch ? numericMatch[1] : '';
        const storedNumericValue = storedNumeric ? parseFloat(storedNumeric) : 0;

        // If the on-chain resolver determined a COMPLETELY different direction than
        // the logger (e.g. logger said 'Sent' but on-chain says we 'received' funds),
        // we must explicitly use the on-chain data because the locally stored amount
        // might correspond to the wrong token or the wrong side of the exchange!
        const isSwap = cat === 'swap' || title.includes('swapped');
        const directionMismatch = onChain && (
            (onChain.resolvedDirection === 'sent' && (cat === 'received' || cat === 'receive')) ||
            (onChain.resolvedDirection === 'received' && (cat === 'send' || cat === 'sent' || cat === 'transfer'))
        );
        const useOnChain = !!onChain && (isSwap || !storedNumericValue || directionMismatch);
        const rawAmount = useOnChain && onChain ? onChain.amount : (storedNumeric || '0');
        const displayAmount = String(rawAmount).match(/^\s*([0-9]+(?:\.[0-9]+)?)/)?.[1] ?? '0';
        const displaySymbol = useOnChain && onChain?.tokenSymbol
            ? onChain.tokenSymbol
            : (item.tokenSymbol || '');

        // Relabel rows whose stored category disagrees with on-chain truth.
        // The resolver tries 'received' first and falls back to 'sent', so
        // resolvedDirection='sent' means there was NO received leg — a row
        // stored as 'Swap' in that case is really just a Send (which is
        // exactly the mis-logged-send → Swap bug). Receives similarly get
        // corrected if they ended up under another label.
        const effectiveCategory = (() => {
            if (!onChain) return item.category || item.type;
            if (onChain.resolvedDirection === 'sent'
                && cat !== 'sent' && cat !== 'send' && cat !== 'transfer') return 'Sent';
            if (onChain.resolvedDirection === 'received'
                && cat !== 'received' && cat !== 'receive' && !isSwap) return 'Received';
            return item.category || item.type;
        })();
        const effectiveCategoryLower = effectiveCategory.toLowerCase();
        const isReceived = effectiveCategoryLower === 'received' || effectiveCategoryLower.includes('received');
        const amountColor = isReceived ? '#498F00' : colors.titleText;
        // Broadened — matches "Sent", "Send", "Transfer", "Sent USDT",
        // "Transfer to ...", title-based "sent", etc. Any historical row
        // the user considers a Send should get a Receipt affordance.
        const isSent =
            !isReceived && (
                effectiveCategoryLower.includes('sent') ||
                effectiveCategoryLower.includes('send') ||
                effectiveCategoryLower.includes('transfer') ||
                title.includes('sent') ||
                title.includes('send')
            );

        const openReceipt = () => {
            if (!item.hash) {
                Alert.alert(
                    'Receipt unavailable',
                    'This transaction is missing its hash, so a receipt cannot be generated.',
                );
                return;
            }
            // Use the on-chain-resolved amount/symbol when our stored values
            // are missing so the receipt matches what the row displays.
            const activityForReceipt: UnifiedActivity = {
                ...item,
                amount: displayAmount,
                tokenSymbol: displaySymbol || item.tokenSymbol,
            };
            const r = buildReceiptFromActivity(activityForReceipt, activeAddress, chains);
            if (r) setViewingReceipt(r);
        };

        const openExplorer = () => {
            if (item.hash) {
                const url = getExplorerUrl(item.hash, item.chainId);
                router.push({ pathname: '/browser', params: { url } });
            }
        };

        // Non-Sent rows: whole row taps through to the block explorer.
        // Sent rows: keep the middle Receipt pill, so only the left+right
        // open the explorer and the middle opens the receipt modal.
        if (!isSent) {
            return (
                <TouchableOpacity
                    style={styles.activityItem}
                    activeOpacity={0.7}
                    onPress={openExplorer}
                >
                    <View style={styles.leftContent}>
                        <Text style={styles.activityLabel}>{effectiveCategory}</Text>
                        <Text style={styles.activityDate}>{item.date}</Text>
                    </View>
                    <View style={styles.rightContent}>
                        <Text style={[styles.activityAmount, { color: amountColor }]}>
                            {displayAmount} {displaySymbol}
                        </Text>
                        <Text style={styles.activityUsd}>{item.usdValue || '$0.00'}</Text>
                    </View>
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.activityItem}>
                {/* Left Side: Type and Date — tap to open explorer */}
                <TouchableOpacity
                    style={styles.leftContent}
                    activeOpacity={0.7}
                    onPress={openExplorer}
                >
                    <Text style={styles.activityLabel}>{effectiveCategory}</Text>
                    <Text style={styles.activityDate}>{item.date}</Text>
                </TouchableOpacity>

                {/* Middle: Receipt link */}
                <View style={styles.middleContent}>
                    <TouchableOpacity
                        onPress={openReceipt}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.receiptLink}>Receipt</Text>
                    </TouchableOpacity>
                </View>

                {/* Right Side: Amount and USD Value — tap to open explorer */}
                <TouchableOpacity
                    style={styles.rightContent}
                    activeOpacity={0.7}
                    onPress={openExplorer}
                >
                    <Text style={[styles.activityAmount, { color: amountColor }]}>
                        {displayAmount} {displaySymbol}
                    </Text>
                    <Text style={styles.activityUsd}>{item.usdValue || '$0.00'}</Text>
                </TouchableOpacity>
            </View>
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

            <ReceiptViewerModal
                visible={!!viewingReceipt}
                receipt={viewingReceipt}
                onClose={() => setViewingReceipt(null)}
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        width: '100%',
    },
    leftContent: {
        gap: 4,
    },
    middleContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
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
    receiptLink: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.primaryCTA,
        textDecorationLine: 'underline',
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
