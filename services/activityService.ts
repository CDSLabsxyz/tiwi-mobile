import { supabase } from '@/lib/supabase';

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

class ActivityService {
    /**
     * Log a new user activity to Supabase
     */
    async logActivity(activity: UserActivity): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_activities')
                .insert([{
                    ...activity,
                    user_wallet: activity.user_wallet.toLowerCase(),
                    created_at: new Date().toISOString()
                }]);

            if (error) {
                console.error('[ActivityService] Error logging activity:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('[ActivityService] Exception logging activity:', error);
            return false;
        }
    }

    /**
     * Fetch activities for a specific wallet
     */
    async getActivities(walletAddress: string, limit = 20): Promise<UserActivity[]> {
        try {
            const { data, error } = await supabase
                .from('user_activities')
                .select('*')
                .eq('user_wallet', walletAddress.toLowerCase())
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('[ActivityService] Error fetching activities:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('[ActivityService] Exception fetching activities:', error);
            return [];
        }
    }

    /**
     * Mark an activity as read
     */
    async markAsRead(activityId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_activities')
                .update({ is_read: true })
                .eq('id', activityId);

            if (error) {
                console.error('[ActivityService] Error marking as read:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('[ActivityService] Exception marking as read:', error);
            return false;
        }
    }

    /**
     * Mark all activities for a wallet as read
     */
    async markAllAsRead(walletAddress: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_activities')
                .update({ is_read: true })
                .eq('user_wallet', walletAddress.toLowerCase())
                .eq('is_read', false);

            if (error) {
                console.error('[ActivityService] Error marking all as read:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('[ActivityService] Exception marking all as read:', error);
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
    ) {
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
    ) {
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
