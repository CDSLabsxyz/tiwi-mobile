import { supabase } from '@/lib/supabase';
import { useWalletStore } from '@/store/walletStore';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is open
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

class NotificationService {
    /**
     * Request permissions and get the Expo Push Token
     */
    async registerForPushNotifications(walletAddress?: string): Promise<string | null> {
        let token: string | null = null;

        // If no address provided, try to get from store
        const address = walletAddress || useWalletStore.getState().address;

        if (!address) {
            console.warn('[NotificationService] No wallet address available for registration');
            return null;
        }

        if (!Device.isDevice) {
            console.warn('Push notifications require a physical device');
            return null;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.warn('Failed to get push token for push notification!');
                return null;
            }

            token = (await Notifications.getExpoPushTokenAsync()).data;

            if (token) {
                await this.saveTokenToBackend(address, token);
            }

            if (Platform.OS === 'android') {
                Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
        } catch (error) {
            console.error('[NotificationService] Error registering for push notifications:', error);
        }

        return token;
    }

    /**
     * Save/Update the hash token in Supabase
     */
    private async saveTokenToBackend(walletAddress: string, token: string) {
        try {
            const { error } = await supabase
                .from('user_push_tokens')
                .upsert({
                    user_wallet: walletAddress.toLowerCase(),
                    push_token: token,
                    device_type: Platform.OS,
                    device_name: Device.modelName || 'Unknown Device',
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'push_token'
                });

            if (error) {
                console.error('[NotificationService] Error saving token to backend:', error);
            }
        } catch (error) {
            console.error('[NotificationService] Exception saving token to backend:', error);
        }
    }

    /**
     * Send a test local notification
     */
    async sendTestNotification() {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Security Verified ✅",
                body: "Your notifications are active. We'll keep you updated",
                data: { data: 'goes here' },
            },
            trigger: null, // trigger: null means show immediately
        });
    }

    /**
     * Send a welcome notification for new users (DEX Protocol style)
     */
    async sendWelcomeNotification() {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Welcome to TIWI Protocol",
                body: "Welcome to the front lines of DeFi. The battle for decentralized dominance begins now.",
                data: { type: 'welcome' },
            },
            trigger: { seconds: 2, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, }, // Delay slightly for effect
        });
    }

    /**
     * Deactivate a token (e.g. on logout)
     */
    async deactivateToken(token: string) {
        try {
            const { error } = await supabase
                .from('user_push_tokens')
                .update({ is_active: false })
                .eq('push_token', token);

            if (error) {
                console.error('[NotificationService] Error deactivating token:', error);
            }
        } catch (error) {
            console.error('[NotificationService] Exception deactivating token:', error);
        }
    }
}

export const notificationService = new NotificationService();

// Standalone exports for easier use in components
export async function registerForPushNotificationsAsync(address?: string) {
    return notificationService.registerForPushNotifications(address);
}

export async function sendTestNotification() {
    return notificationService.sendTestNotification();
}

export async function sendWelcomeNotification() {
    return notificationService.sendWelcomeNotification();
}
