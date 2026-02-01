import { colors } from '@/constants/colors';
import { useNotifications } from '@/hooks/useNotifications';
import { activityService, ActivityType, UserActivity } from '@/services/activityService';
import { adminNotificationService } from '@/services/adminNotificationService';
import { useWalletStore } from '@/store/walletStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const CATEGORIES: { label: string; value: ActivityType | 'all' | 'announcement' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Announcements', value: 'announcement' },
    { label: 'Transactions', value: 'transaction' },
    { label: 'Rewards', value: 'reward' },
    { label: 'Security', value: 'security' },
    { label: 'Governance', value: 'governance' },
];

export default function NotificationsScreen() {
    const router = useRouter();
    const { address } = useWalletStore();
    const { activities, adminNotifications, loading, refresh } = useNotifications();
    const [filter, setFilter] = useState<ActivityType | 'all' | 'announcement'>('all');
    const [viewedAdminIds, setViewedAdminIds] = useState<Set<string>>(new Set());

    // Merge and sort all notifications
    const allNotifications = [
        ...activities.map(a => ({ ...a, displayType: 'activity' as const })),
        ...adminNotifications.map(n => ({ ...n, displayType: 'admin' as const }))
    ].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
    });

    const filteredList = allNotifications.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'announcement') return item.displayType === 'admin';
        if (item.displayType === 'activity') return (item as UserActivity).type === filter;
        return false;
    });

    const handleMarkAllRead = async () => {
        if (!address) return;
        await Promise.all([
            activityService.markAllAsRead(address),
            adminNotificationService.markAsViewed(address, adminNotifications.map(n => n.id))
        ]);
        refresh();
    };

    const handleItemPress = async (item: any) => {
        if (!address) return;

        if (item.displayType === 'activity') {
            if (item.id) activityService.markAsRead(item.id);
            // Handle activity deep linking
        } else {
            await adminNotificationService.markAsViewed(address, [item.id]);
        }
        refresh();
    };

    const isUnread = (item: any) => {
        if (item.displayType === 'activity') return !item.is_read;
        const viewed = viewedAdminIds.has(item.id);
        return !viewed;
    };

    const renderItem = ({ item }: { item: any }) => {
        const isActivity = item.displayType === 'activity';
        const unread = isUnread(item);

        const getIcon = () => {
            if (!isActivity) {
                switch (item.priority) {
                    case 'critical': return 'alert-circle';
                    case 'important': return 'megaphone';
                    default: return 'megaphone-outline';
                }
            }
            switch (item.type) {
                case 'transaction': return 'swap-horizontal';
                case 'reward': return 'gift-outline';
                case 'governance': return 'people-outline';
                case 'security': return 'shield-checkmark-outline';
                case 'system': return 'information-circle-outline';
                default: return 'notifications-outline';
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
                    <Ionicons name={getIcon() as any} size={20} color={getIconColor()} />
                </View>
                <View style={styles.contentContainer}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{isActivity ? item.title : item.title}</Text>
                        <Text style={styles.time}>
                            {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ''}
                        </Text>
                    </View>
                    <Text style={styles.message} numberOfLines={2}>
                        {isActivity ? item.message : item.message_body}
                    </Text>

                    {/* Deep link info for transactions */}
                    {isActivity && item.type === 'transaction' && item.metadata?.transaction_hash && (
                        <View style={styles.metadataRow}>
                            <Ionicons name="link-outline" size={12} color={colors.mutedText} />
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
                    <Ionicons name="arrow-back" size={24} color={colors.bodyText} />
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
                    <ActivityIndicator color={colors.primaryCTA} />
                </View>
            ) : filteredList.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="notifications-off-outline" size={48} color={colors.bgSemi} />
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
