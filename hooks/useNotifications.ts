import { activityService, UserActivity } from '@/services/activityService';
import { AdminNotification, adminNotificationService } from '@/services/adminNotificationService';
import { useWalletStore } from '@/store/walletStore';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLLING_INTERVAL = 200000; // 200 seconds as requested

export function useNotifications() {
    const { address } = useWalletStore();
    const [unreadCount, setUnreadCount] = useState(0);
    const [activities, setActivities] = useState<UserActivity[]>([]);
    const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
    const [viewedAdminIds, setViewedAdminIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // Use a ref to keep track of the timer to avoid multiple intervals
    const pollingTimer = useRef<NodeJS.Timeout | null>(null);

    const refreshData = useCallback(async (showLoading = false) => {
        if (!address) {
            setUnreadCount(0);
            return;
        }

        if (showLoading) setLoading(true);

        try {
            // Fetch both personal activities and global admin notifications
            const [localActivities, { notifications: globalNotifications, unreadCount: adminUnreadCount }] = await Promise.all([
                activityService.getActivities(address, 50),
                adminNotificationService.getAdminNotifications(address)
            ]);

            setActivities(localActivities);
            setAdminNotifications(globalNotifications);

            // Fetch unread list ONLY to derive viewed IDs (or we could assume the API handles it)
            // For now, let's fetch unread too to maintain the viewedAdminIds set logic used in the UI
            const { notifications: unreadAdminList } = await adminNotificationService.getAdminNotifications(address, true);
            const unreadAdminIds = new Set(unreadAdminList.map(n => n.id));

            // Derive viewed IDs from the difference
            const vIds = new Set(globalNotifications.map(n => n.id).filter(id => !unreadAdminIds.has(id)));
            setViewedAdminIds(vIds);

            // Calculate totals
            const localUnread = localActivities.filter(a => !a.is_read).length;
            setUnreadCount(localUnread + adminUnreadCount);

        } catch (error) {
            console.error('[useNotifications] Refresh failed:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [address]);

    // Start polling
    useEffect(() => {
        if (!address) return;

        // Immediate fetch on mount/wallet change
        refreshData(true);

        // Setup interval
        pollingTimer.current = setInterval(() => {
            refreshData(false);
        }, POLLING_INTERVAL);

        return () => {
            if (pollingTimer.current) {
                clearInterval(pollingTimer.current);
            }
        };
    }, [address, refreshData]);

    return {
        unreadCount,
        activities,
        adminNotifications,
        viewedAdminIds,
        loading,
        refresh: () => refreshData(true)
    };
}
