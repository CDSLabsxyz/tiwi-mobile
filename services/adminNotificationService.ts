
export type NotificationStatus = 'live' | 'removed' | 'scheduled';
export type NotificationPriority = 'normal' | 'important' | 'critical';
export type NotificationDeliveryType = 'push' | 'banner' | 'modal';

export interface AdminNotification {
    id: string;
    title: string;
    message_body: string;
    status: NotificationStatus;
    priority: NotificationPriority;
    delivery_type: NotificationDeliveryType;
    created_at: string;
    scheduled_for?: string;
    created_by?: string;
}

const ADMIN_API_BASE = 'https://app.tiwiprotocol.xyz/api/v1/notifications';

class AdminNotificationService {
    /**
     * Fetch active broadcast notifications from the central API
     */
    async getAdminNotifications(walletAddress: string, unreadOnly = false) {
        try {
            const url = `${ADMIN_API_BASE}?status=live&userWallet=${encodeURIComponent(walletAddress)}&unreadOnly=${unreadOnly}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.warn('[AdminNotificationService] API request failed:', response.status);
                return { notifications: [], unreadCount: 0 };
            }

            const data = await response.json();

            // Expected response: {"notifications": [...], "total": X, "unreadCount": Y}
            return {
                notifications: (data.notifications as AdminNotification[]) || [],
                unreadCount: data.unreadCount || 0
            };
        } catch (error) {
            console.error('[AdminNotificationService] Exception fetching via API:', error);
            return { notifications: [], unreadCount: 0 };
        }
    }

    /**
     * Mark admin notifications as viewed using the central API
     */
    async markAsViewed(walletAddress: string, notificationIds: string[]): Promise<void> {
        if (notificationIds.length === 0) return;

        try {
            const url = `${ADMIN_API_BASE}/mark-viewed`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    notificationIds,
                    userWallet: walletAddress
                })
            });

            if (!response.ok) {
                console.warn('[AdminNotificationService] Mark viewed failed:', response.status);
            }
        } catch (error) {
            console.error('[AdminNotificationService] Exception marking viewed via API:', error);
        }
    }
}

export const adminNotificationService = new AdminNotificationService();
