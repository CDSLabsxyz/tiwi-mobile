import { colors } from '@/constants/colors';
import { api } from '@/lib/mobile/api-client';
import { useWalletStore } from '@/store/walletStore';
import { truncateAddress } from '@/utils/wallet';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Transaction {
    type: 'buy' | 'sell';
    maker: string;
    amountToken: number;
    amountUsd: number;
    priceUsd: number;
    timestamp: string;
    hash: string;
}

interface TokenTransactionsProps {
    transactions: Transaction[];
    tokenSymbol: string;
    tokenAddress: string;
    chainId: number;
}

type MainTab = 'transactions' | 'traders' | 'holders' | 'wallet';
type FilterTab = 'all' | 'buys' | 'sells';

function formatTimestamp(timestamp: string): string {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function formatAmount(value: number): string {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatValue(value: number): string {
    const val = typeof value === 'string' ? parseFloat(value) : value;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export const TokenTransactions: React.FC<TokenTransactionsProps> = ({ 
    transactions, 
    tokenSymbol,
    tokenAddress,
    chainId 
}) => {
    const { activeAddress } = useWalletStore();
    const [mainTab, setMainTab] = useState<MainTab>('transactions');
    const [filterTab, setFilterTab] = useState<FilterTab>('all');

    const handleTxPress = (hash: string) => {
        const explorers: Record<number, string> = {
            1: `https://etherscan.io/tx/${hash}`,
            56: `https://bscscan.com/tx/${hash}`,
            137: `https://polygonscan.com/tx/${hash}`,
            42161: `https://arbiscan.io/tx/${hash}`,
            10: `https://optimistic.etherscan.io/tx/${hash}`,
            8453: `https://basescan.org/tx/${hash}`,
            43114: `https://snowtrace.io/tx/${hash}`,
            250: `https://ftmscan.com/tx/${hash}`,
            756516149: `https://solscan.io/tx/${hash}`,
            7565164: `https://solscan.io/tx/${hash}`,
        };
        const url = explorers[chainId] || `https://bscscan.com/tx/${hash}`;
        Linking.openURL(url);
    };

    // 1. Filtered Transactions
    const filteredTxns = useMemo(() => {
        return transactions.filter(tx => {
            if (filterTab === 'all') return true;
            return tx.type === (filterTab === 'buys' ? 'buy' : 'sell');
        });
    }, [transactions, filterTab]);

    // 2. Top Traders Calculation
    const sortedTraders = useMemo(() => {
        const traders: Record<string, { volume: number; buys: number; sells: number }> = {};
        transactions.forEach(tx => {
            const maker = tx.maker || 'Unknown';
            if (!traders[maker]) {
                traders[maker] = { volume: 0, buys: 0, sells: 0 };
            }
            traders[maker].volume += (tx.amountUsd || 0);
            if (tx.type === 'buy') traders[maker].buys += 1;
            else traders[maker].sells += 1;
        });
        return Object.entries(traders)
            .map(([address, stats]) => ({ address, ...stats }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 50);
    }, [transactions]);

    // 3. Wallet Transactions Fetching
    const { data: walletTxns, isLoading: isWalletLoading } = useQuery({
        queryKey: ['walletTransactions', activeAddress, chainId, tokenAddress],
        queryFn: async () => {
            if (!activeAddress) return [];
            try {
                const res = await api.wallet.transactions({ address: activeAddress, chainId: chainId });
                return (res as any[] || []).filter((tx: any) => 
                    tx.tokenAddress?.toLowerCase() === tokenAddress?.toLowerCase() ||
                    tx.metadata?.toTokenAddress?.toLowerCase() === tokenAddress?.toLowerCase() ||
                    tx.metadata?.fromTokenAddress?.toLowerCase() === tokenAddress?.toLowerCase()
                );
            } catch (e) {
                console.warn('[WalletTx] Fetch failed:', e);
                return [];
            }
        },
        enabled: mainTab === 'wallet' && !!activeAddress,
    });

    const renderMainTab = () => {
        switch (mainTab) {
            case 'transactions':
                return (
                    <View style={styles.tabContent}>
                        {/* Sub Filters */}
                        <View style={styles.filterRow}>
                            {(['all', 'buys', 'sells'] as FilterTab[]).map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    onPress={() => setFilterTab(f)}
                                    style={[
                                        styles.filterTab,
                                        filterTab === f && styles.filterTabActive,
                                        filterTab === f && f === 'buys' && { backgroundColor: '#163a13' },
                                        filterTab === f && f === 'sells' && { backgroundColor: '#3a1313' }
                                    ]}
                                >
                                    <Text style={[
                                        styles.filterTabText,
                                        filterTab === f && { color: f === 'buys' ? colors.success : f === 'sells' ? colors.error : colors.primaryCTA }
                                    ]}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.columnHeader, { flex: 1.2 }]}>Time</Text>
                            <Text style={[styles.columnHeader, { flex: 0.8 }]}>Type</Text>
                            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Amount</Text>
                            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Value</Text>
                        </View>

                        {/* Table Body */}
                        {filteredTxns.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No transactions found</Text>
                            </View>
                        ) : (
                            filteredTxns.map((tx, i) => (
                                <TouchableOpacity 
                                    key={`${tx.hash}-${i}`} 
                                    style={styles.txRow}
                                    onPress={() => handleTxPress(tx.hash)}
                                >
                                    <Text style={[styles.cellText, styles.timeText, { flex: 1.2 }]}>{formatTimestamp(tx.timestamp)}</Text>
                                    <Text style={[
                                        styles.cellText, 
                                        { flex: 0.8, color: tx.type === 'buy' ? colors.success : colors.error, fontFamily: 'Manrope-Bold' }
                                    ]}>
                                        {tx.type.toUpperCase()}
                                    </Text>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={[styles.cellText, { color: colors.titleText }]}>{formatAmount(tx.amountToken)}</Text>
                                        <Text style={styles.subCellText}>{tokenSymbol}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <Text style={[styles.cellText, { color: colors.titleText }]}>{formatValue(tx.amountUsd)}</Text>
                                        <Text style={[styles.subCellText, { color: colors.primaryCTA }]}>{truncateAddress(tx.maker)}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                );

            case 'traders':
                return (
                    <View style={styles.tabContent}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.columnHeader, { flex: 2 }]}>Trader</Text>
                            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>B/S</Text>
                            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Volume</Text>
                        </View>
                        {sortedTraders.map((trader, i) => (
                            <View key={i} style={styles.txRow}>
                                <TouchableOpacity onPress={() => handleTxPress(trader.address)} style={{ flex: 2 }}>
                                    <Text style={[styles.cellText, { color: colors.primaryCTA }]}>{truncateAddress(trader.address)}</Text>
                                </TouchableOpacity>
                                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
                                    <Text style={[styles.cellText, { color: colors.success }]}>{trader.buys}</Text>
                                    <Text style={[styles.cellText, { color: colors.mutedText }]}>/</Text>
                                    <Text style={[styles.cellText, { color: colors.error }]}>{trader.sells}</Text>
                                </View>
                                <Text style={[styles.cellText, { flex: 1, textAlign: 'right', color: colors.titleText }]}>
                                    {formatValue(trader.volume)}
                                </Text>
                            </View>
                        ))}
                    </View>
                );

            case 'holders':
                return (
                    <View style={styles.emptyContainer}>
                        <View style={styles.comingSoonIcon}>
                            <Ionicons name="people-outline" size={32} color={colors.mutedText} />
                        </View>
                        <Text style={styles.comingSoonTitle}>Holder Analytics</Text>
                        <Text style={styles.comingSoonDesc}>Detailed distribution data is currently being synced from the blockchain. Check back soon.</Text>
                    </View>
                );

            case 'wallet':
                if (!activeAddress) {
                    return (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="wallet-outline" size={32} color={colors.mutedText} style={{ marginBottom: 12 }} />
                            <Text style={styles.emptyText}>Connect wallet to view your history</Text>
                        </View>
                    );
                }
                if (isWalletLoading) {
                    return <ActivityIndicator color={colors.primaryCTA} style={{ marginTop: 40 }} />;
                }
                return (
                    <View style={styles.tabContent}>
                         <View style={styles.tableHeader}>
                            <Text style={[styles.columnHeader, { flex: 1 }]}>Date</Text>
                            <Text style={[styles.columnHeader, { flex: 1 }]}>Type</Text>
                            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Tokens</Text>
                            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Value</Text>
                        </View>
                        {walletTxns?.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No personal trades found</Text>
                            </View>
                        ) : (
                            walletTxns?.map((tx: any, i: number) => (
                                <View key={i} style={styles.txRow}>
                                    <Text style={[styles.cellText, styles.timeText, { flex: 1 }]}>{tx.date?.split(',')[0] || 'Unknown'}</Text>
                                    <Text style={[styles.cellText, { flex: 1, color: colors.titleText }]}>{tx.type?.toUpperCase() || 'TX'}</Text>
                                    <Text style={[styles.cellText, { flex: 1, textAlign: 'right', color: colors.titleText }]}>{formatAmount(parseFloat(tx.amountFormatted || '0'))}</Text>
                                    <Text style={[styles.cellText, { flex: 1, textAlign: 'right', color: colors.success }]}>${parseFloat(tx.usdValue || '0').toFixed(2)}</Text>
                                </View>
                            ))
                        )}
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Main Tabs Horizontal Scroll */}
            <View style={styles.tabsHeader}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mainTabsContent}>
                    {[
                        { id: 'transactions', label: 'Latest Transactions' },
                        { id: 'traders', label: 'Top Traders' },
                        { id: 'holders', label: 'Holders' },
                        { id: 'wallet', label: 'Wallet Tx' }
                    ].map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => setMainTab(tab.id as MainTab)}
                            style={[styles.mainTabBtn, mainTab === tab.id && styles.mainTabBtnActive]}
                        >
                            <Text style={[styles.mainTabText, mainTab === tab.id && styles.mainTabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {renderMainTab()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    tabsHeader: {
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
        backgroundColor: colors.bgSemi,
    },
    mainTabsContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 24,
    },
    mainTabBtn: {
        paddingBottom: 4,
    },
    mainTabBtnActive: {
        borderBottomWidth: 2,
        borderBottomColor: colors.primaryCTA,
    },
    mainTabText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
    mainTabTextActive: {
        color: colors.titleText,
        fontFamily: 'Manrope-Bold',
    },
    tabContent: {
        paddingTop: 0,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: colors.bgSemi,
    },
    filterTabActive: {
        backgroundColor: colors.bgStroke,
    },
    filterTabText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.mutedText,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: colors.bgSemi,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke,
    },
    columnHeader: {
        fontFamily: 'Manrope-Medium',
        fontSize: 11,
        color: colors.mutedText,
        textTransform: 'uppercase',
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgStroke + '40', // Semi-transparent
    },
    cellText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 12,
        color: colors.bodyText,
    },
    timeText: {
        color: colors.mutedText,
        fontSize: 11,
        fontFamily: 'Manrope-Medium',
    },
    subCellText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
        marginTop: 2,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
        marginTop: 12,
    },
    comingSoonIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.bgCards,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    comingSoonTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
        marginBottom: 8,
    },
    comingSoonDesc: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 20,
    },
});
