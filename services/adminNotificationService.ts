import { api, Notification as SDKNotification } from '@/lib/mobile/api-client';

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

class AdminNotificationService {
    /**
     * Fetch active broadcast notifications from the central API
     */
    async getAdminNotifications(walletAddress: string, unreadOnly = false) {
        try {
            const response = await api.notifications.list({
                status: 'live',
                userWallet: walletAddress,
                unreadOnly
            });

            const notifications = (response.notifications || []).map(n => ({
                id: n.id,
                title: n.title,
                message_body: n.messageBody || '',
                status: n.status as any,
                priority: n.priority as any,
                delivery_type: n.deliveryType || 'banner',
                created_at: n.createdAt
            }));

            return {
                notifications: notifications as AdminNotification[],
                unreadCount: response.unreadCount || 0
            };
        } catch (error: any) {
            console.error('[AdminNotificationService] Exception fetching notifications:', error);
            return { notifications: [], unreadCount: 0 };
        }
    }

    /**
     * Mark admin notifications as viewed using the central API
     */
    async markAsViewed(walletAddress: string, notificationIds: string[]): Promise<void> {
        if (notificationIds.length === 0) return;

        try {
            // SDK currently supports single ID per call according to signature
            await Promise.all(
                notificationIds.map(id =>
                    api.notifications.markViewed({
                        notificationId: id,
                        userWallet: walletAddress
                    })
                )
            );
        } catch (error: any) {
            console.error('[AdminNotificationService] Exception marking viewed:', error);
        }
    }
}

export const adminNotificationService = new AdminNotificationService();
