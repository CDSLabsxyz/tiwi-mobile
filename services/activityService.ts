import { supabase } from '@/lib/supabase';
import type { PostgrestResponse } from '@supabase/supabase-js';
import { notificationService } from './notificationService';

export type ActivityType = 'transaction' | 'reward' | 'governance' | 'security' | 'system';

export interface UserActivity {
    id?: string;
    user_wallet: string;
    type: ActivityType;
    category: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    is_read?: boolean;
    created_at?: string;
}

// Database-specific row interface to match schema precisely
interface ActivityRow {
    user_wallet: string;
    type: ActivityType;
    category: string;
    title: string;
    message: string;
    metadata: any;
    is_read: boolean;
    created_at: string;
}

class ActivityService {
    private readonly TABLE_NAME = 'user_activities';

    /**
     * Log a new user activity to Supabase
     */
    async logActivity(activity: UserActivity): Promise<boolean> {
        try {
            const payload: ActivityRow = {
                user_wallet: activity.user_wallet.toLowerCase(),
                type: activity.type,
                category: activity.category,
                title: activity.title,
                message: activity.message,
                metadata: activity.metadata || {},
                is_read: activity.is_read || false,
                created_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from(this.TABLE_NAME)
                .insert([payload]);

            if (error) throw error;
            return true;
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[ActivityService] Log: Network unreachable.');
            } else {
                console.error('[ActivityService] Exception logging activity:', error);
            }
            return false;
        }
    }

    /**
     * Fetch activities for a specific wallet
     */
    async getActivities(walletAddress: string, limit = 20): Promise<UserActivity[]> {
        try {
            const { data, error }: PostgrestResponse<UserActivity> = await supabase
                .from(this.TABLE_NAME)
                .select('*')
                .eq('user_wallet', walletAddress.toLowerCase())
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[ActivityService] Fetch: Network unreachable.');
            } else {
                console.error('[ActivityService] Exception fetching activities:', error);
            }
            return [];
        }
    }

    /**
     * Mark an activity as read
     */
    async markAsRead(activityId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(this.TABLE_NAME)
                .update({ is_read: true })
                .eq('id', activityId);

            if (error) throw error;
            return true;
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[ActivityService] MarkRead: Network unreachable.');
            } else {
                console.error('[ActivityService] Exception marking as read:', error);
            }
            return false;
        }
    }

    /**
     * Mark all activities for a wallet as read
     */
    async markAllAsRead(walletAddress: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(this.TABLE_NAME)
                .update({ is_read: true })
                .eq('user_wallet', walletAddress.toLowerCase())
                .eq('is_read', false);

            if (error) throw error;
            return true;
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[ActivityService] MarkAllRead: Network unreachable.');
            } else {
                console.error('[ActivityService] Exception marking all as read:', error);
            }
            return false;
        }
    }

    /**
     * Helper: Log a transaction activity
     */
    async logTransaction(
        walletAddress: string,
        txType: string,
        title: string,
        message: string,
        txHash?: string,
        metadata: Record<string, any> = {}
    ): Promise<boolean> {
        // Fire local push notification for transaction events
        const notifType = txType === 'swap' ? 'swap'
            : txType === 'received' ? 'received'
            : txType === 'sent' ? 'sent'
            : txType === 'failed' ? 'failed'
            : txType === 'confirmed' ? 'confirmed'
            : null;

        if (notifType) {
            notificationService.sendTransactionNotification(notifType, {
                symbol: metadata?.symbol,
                amount: metadata?.amount,
                txHash,
            });
        }

        return this.logActivity({
            user_wallet: walletAddress,
            type: 'transaction',
            category: txType,
            title,
            message,
            metadata: { ...metadata, txHash }
        });
    }

    /**
     * Helper: Log a security activity
     */
    async logSecurityEvent(
        walletAddress: string,
        event: string,
        title: string,
        message: string,
        metadata: Record<string, any> = {}
    ): Promise<boolean> {
        return this.logActivity({
            user_wallet: walletAddress,
            type: 'security',
            category: event,
            title,
            message,
            metadata
        });
    }
}

export const activityService = new ActivityService();
