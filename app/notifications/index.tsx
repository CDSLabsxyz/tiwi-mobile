import { colors } from '@/constants/colors';
import { activityService, ActivityType } from '@/services/activityService';
import { useWalletStore } from '@/store/walletStore';
import { useUnifiedActivities } from '@/hooks/useUnifiedActivities';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useState, useCallback, useEffect } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';

const ChevronLeftIcon = require('../../assets/swap/arrow-left-02.svg');
const AlertCircle = require('../../assets/settings/alert-circle.svg');
const Megaphone = require('../../assets/settings/news-01.svg');
const TransactionIcon = require('../../assets/home/transaction-history.svg');
const CrownIcon = require('../../assets/settings/crown.svg');
const UserGroup = require('../../assets/settings/user-group-02.svg');
const SecurityLock = require('../../assets/settings/security-lock.svg');
const NotificationIcon = require('../../assets/settings/notification-02.svg');

const CATEGORIES: { label: string; value: ActivityType | 'all' | 'announcement' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Announcements', value: 'announcement' },
    { label: 'Transactions', value: 'transaction' },
];

export default function NotificationsScreen() {
    const router = useRouter();
    const { address } = useWalletStore();
    const [filter, setFilter] = useState<ActivityType | 'all' | 'announcement'>('all');
    const [viewedAdminIds, setViewedAdminIds] = useState<Set<string>>(new Set());

    const { data: unifiedActivities = [], isLoading: isUnifiedLoading, refetch: refetchUnified } = useUnifiedActivities(100);
    const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
    const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);

    const fetchAnnouncements = useCallback(async () => {
        if (!address) return;
        setIsLoadingAnnouncements(true);
        try {
            const response = await fetch(`https://app.tiwiprotocol.xyz/api/v1/notifications?status=live&userWallet=${encodeURIComponent(address)}`);
            if (response.ok) {
                const data = await response.json();
                setLiveAnnouncements(data.notifications || []);
                
                // Track already-viewed ones via UI status returned by API if supported, or locally 
                // for simplicity, we assume ones returned without explicitly viewed logic act like the dropdown
            }
        } catch (error) {
            console.error("Error fetching announcements:", error);
        } finally {
            setIsLoadingAnnouncements(false);
        }
    }, [address]);

    useEffect(() => {
        if (address) {
            fetchAnnouncements();
        }
    }, [address, fetchAnnouncements]);

    const loading = isUnifiedLoading || isLoadingAnnouncements;
    const refresh = () => {
        refetchUnified();
        fetchAnnouncements();
    };

    // Merge and sort all notifications
    const allNotifications = [
        ...unifiedActivities.map(a => ({ ...a, displayType: 'activity' as const })),
        ...liveAnnouncements.map(n => ({ ...n, displayType: 'admin' as const }))
    ].sort((a, b) => {
        const dateA = a.displayType === 'activity' ? (a.timestamp || 0) : new Date(a.createdAt || 0).getTime();
        const dateB = b.displayType === 'activity' ? (b.timestamp || 0) : new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
    });

    const filteredList = allNotifications.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'announcement') return item.displayType === 'admin';
        if (filter === 'transaction') return item.displayType === 'activity' && item.type === 'transaction';
        return false;
    });

    const handleMarkAllRead = async () => {
        if (!address) return;
        // Mark activities read locally
        await activityService.markAllAsRead(address);

        // Mark announcements read remotely
        if (liveAnnouncements.length > 0) {
            try {
                const notificationIds = liveAnnouncements.map(n => n.id);
                await fetch("https://app.tiwiprotocol.xyz/api/v1/notifications/mark-viewed", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notificationIds, userWallet: address }),
                });
                setViewedAdminIds(prev => {
                    const next = new Set(prev);
                    notificationIds.forEach(id => next.add(id));
                    return next;
                });
            } catch (error) {
                console.error("Error marking notifications as viewed:", error);
            }
        }
        refresh();
    };

    const handleItemPress = async (item: any) => {
        if (!address) return;

        if (item.displayType === 'activity') {
            if (item.id) await activityService.markAsRead(item.id);
            // Handle activity deep linking
        } else {
            try {
                await fetch("https://app.tiwiprotocol.xyz/api/v1/notifications/mark-viewed", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notificationIds: [item.id], userWallet: address }),
                });
                setViewedAdminIds(prev => {
                    const next = new Set(prev);
                    next.add(item.id);
                    return next;
                });
            } catch (error) {
                console.error("Error marking viewed:", error);
            }
        }
        refetchUnified();
    };

    const isUnread = (item: any) => {
        if (item.displayType === 'activity') return !item.is_read;
        return !viewedAdminIds.has(item.id);
    };

    const renderItem = ({ item }: { item: any }) => {
        const isActivity = item.displayType === 'activity';
        const unread = isUnread(item);

        const getIconSource = () => {
            if (!isActivity) {
                switch (item.priority) {
                    case 'critical': return AlertCircle;
                    case 'important': return Megaphone;
                    default: return Megaphone;
                }
            }
            switch (item.type) {
                case 'transaction': return TransactionIcon;
                case 'reward': return CrownIcon;
                case 'governance': return UserGroup;
                case 'security': return SecurityLock;
                case 'system': return NotificationIcon;
                default: return NotificationIcon;
            }
        };

        const getIconBg = () => {
            if (!isActivity) {
                return item.priority === 'critical' ? '#3B1C1C' : '#2A2438';
            }
            switch (item.type) {
                case 'transaction': return '#2D333B';
                case 'reward': return '#1C2E21';
                case 'governance': return '#2A2438';
                case 'security': return '#1B2430';
                case 'system': return '#2A2A2A';
                default: return '#1F1F1F';
            }
        };

        const getIconColor = () => {
            if (!isActivity) {
                return item.priority === 'critical' ? '#FF5C5C' : colors.primaryCTA;
            }
            switch (item.type) {
                case 'transaction': return colors.bodyText;
                case 'reward': return '#4CAF50';
                case 'governance': return '#BB86FC';
                case 'security': return '#03DAC6';
                case 'system': return '#FFA000';
                default: return colors.bodyText;
            }
        };

        return (
            <TouchableOpacity
                style={[styles.activityItem, unread && styles.unreadItem]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: getIconBg() }]}>
                    <Image source={getIconSource()} style={{ width: 20, height: 20 }} tintColor={getIconColor()} contentFit="contain" />
                </View>
                <View style={styles.contentContainer}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.time}>
                            {isActivity 
                                ? (item.timestamp ? formatDistanceToNow(item.timestamp, { addSuffix: true }) : '')
                                : (item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : '')}
                        </Text>
                    </View>
                    <Text style={styles.message} numberOfLines={3}>
                        {isActivity ? item.message : item.messageBody}
                    </Text>

                    {/* Deep link info for transactions */}
                    {isActivity && item.type === 'transaction' && item.metadata?.transaction_hash && (
                        <View style={styles.metadataRow}>
                            <Text style={styles.metadataText} numberOfLines={1}>
                                {item.metadata.transaction_hash}
                            </Text>
                        </View>
                    )}
                </View>
                {unread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Image source={ChevronLeftIcon} style={{ width: 24, height: 24 }} contentFit="contain" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
                    <Text style={styles.markAllText}>Mark all as read</Text>
                </TouchableOpacity>
            </View>

            {/* Filter Chips */}
            <View style={styles.filterContainer}>
                <FlatList
                    data={CATEGORIES}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => setFilter(item.value)}
                            style={[
                                styles.filterChip,
                                filter === item.value && styles.activeFilterChip
                            ]}
                        >
                            <Text style={[
                                styles.filterText,
                                filter === item.value && styles.activeFilterText
                            ]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <TIWILoader size={100} />
                </View>
            ) : filteredList.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Image source={NotificationIcon} style={{ width: 48, height: 48, opacity: 0.3 }} tintColor={colors.bgSemi} contentFit="contain" />
                    <Text style={styles.emptyText}>No notifications found</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredList}
                    renderItem={renderItem}
                    keyExtractor={(item) => (isUnread(item) ? 'unread-' : '') + item.displayType + '-' + item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={refresh}
                            tintColor={colors.primaryCTA}
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Manrope-Bold',
        color: colors.bodyText,
    },
    markAllButton: {
        paddingVertical: 4,
    },
    markAllText: {
        fontSize: 12,
        fontFamily: 'Manrope-Medium',
        color: colors.primaryCTA,
    },
    filterContainer: {
        marginBottom: 10,
    },
    filterList: {
        paddingHorizontal: 20,
        gap: 10,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.bgSemi,
    },
    activeFilterChip: {
        backgroundColor: colors.primaryCTA,
    },
    filterText: {
        fontSize: 14,
        fontFamily: 'Manrope-Medium',
        color: colors.mutedText,
    },
    activeFilterText: {
        color: '#000',
    },
    listContent: {
        paddingBottom: 40,
    },
    activityItem: {
        flexDirection: 'row',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.bgSemi,
        alignItems: 'center',
    },
    unreadItem: {
        backgroundColor: 'rgba(208, 251, 67, 0.1)',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    contentContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Manrope-Bold',
        color: colors.bodyText,
    },
    time: {
        fontSize: 10,
        fontFamily: 'Manrope-Regular',
        color: colors.mutedText,
    },
    message: {
        fontSize: 13,
        fontFamily: 'Manrope-Regular',
        color: colors.mutedText,
        lineHeight: 18,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primaryCTA,
        marginLeft: 10,
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        opacity: 0.7,
    },
    metadataText: {
        fontSize: 11,
        fontFamily: 'Manrope-Medium',
        color: colors.mutedText,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Manrope-Medium',
        color: colors.mutedText,
    }
});
