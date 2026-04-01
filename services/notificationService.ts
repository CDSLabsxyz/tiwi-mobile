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
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[NotificationService] Register: Network unreachable.');
            } else {
                console.error('[NotificationService] Error registering for push notifications:', error);
            }
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

        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[NotificationService] SaveToken: Network unreachable.');
            } else {
                console.error('[NotificationService] Exception saving token to backend:', error);
            }
        }
    }

    /**
     * Send a test local notification
     */
    async sendTestNotification() {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Security Verified",
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
     * Send a local notification for transaction events
     * Respects user's notification preferences
     */
    async sendTransactionNotification(type: 'swap' | 'received' | 'sent' | 'failed' | 'confirmed', details?: { symbol?: string; amount?: string; txHash?: string }) {
        // Check user preferences
        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const prefsRaw = await AsyncStorage.getItem('tiwi_notification_prefs');
            if (prefsRaw) {
                const prefs = JSON.parse(prefsRaw);
                // 'sent' maps to 'swap' preference (both are outgoing tx)
                const prefKey = type === 'sent' ? 'swap' : type;
                if (prefs[prefKey] === false) {
                    console.log(`[NotificationService] ${type} notification disabled by user`);
                    return;
                }
            }
        } catch {
            // If prefs can't be read, send notification anyway
        }
        const configs: Record<string, { title: string; body: string; icon?: string }> = {
            swap: {
                title: 'Swap Completed',
                body: details?.symbol
                    ? `Your swap of ${details.amount || ''} ${details.symbol} was successful.`
                    : 'Your swap was completed successfully.',
            },
            received: {
                title: 'Payment Received',
                body: details?.symbol
                    ? `You received ${details.amount || ''} ${details.symbol}.`
                    : 'You received a new payment.',
            },
            sent: {
                title: 'Transfer Sent',
                body: details?.symbol
                    ? `You sent ${details.amount || ''} ${details.symbol}.`
                    : 'Your transfer was sent successfully.',
            },
            failed: {
                title: 'Transaction Failed',
                body: details?.symbol
                    ? `Your ${details.symbol} transaction failed. Please try again.`
                    : 'A transaction has failed. Please try again.',
            },
            confirmed: {
                title: 'On-chain Confirmation',
                body: details?.txHash
                    ? `Transaction ${details.txHash.slice(0, 10)}... confirmed on-chain.`
                    : 'Your transaction has been confirmed on-chain.',
            },
        };

        const config = configs[type] || configs.swap;

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: config.title,
                    body: config.body,
                    data: { type: 'transaction', txType: type, ...details },
                    sound: 'default',
                },
                trigger: null,
            });
        } catch (e) {
            console.warn('[NotificationService] Failed to send local notification:', e);
        }
    }

    /**
     * Send price update notification for tokens with significant movement
     */
    async sendPriceAlert(symbol: string, changePercent: number, currentPrice: number) {
        // Check user preferences
        try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const prefsRaw = await AsyncStorage.getItem('tiwi_notification_prefs');
            if (prefsRaw) {
                const prefs = JSON.parse(prefsRaw);
                if (prefs['price_alerts'] === false) return;
            }
        } catch {}

        const isUp = changePercent >= 0;
        const direction = isUp ? 'up' : 'down';
        const formattedChange = Math.abs(changePercent).toFixed(2);
        const formattedPrice = currentPrice < 0.01
            ? `$${currentPrice.toExponential(2)}`
            : `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: `${symbol} Price Update`,
                    body: `${symbol} is ${direction} ${formattedChange}% — now at ${formattedPrice}`,
                    data: { type: 'price_alert', symbol, changePercent, currentPrice },
                    sound: 'default',
                },
                trigger: null,
            });
        } catch (e) {
            console.warn('[NotificationService] Price alert failed:', e);
        }
    }

    /**
     * Check wallet tokens for significant price movements and send alerts
     * Called periodically from the app
     */
    async checkPriceAlerts(tokens: any[]) {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const ALERT_KEY = 'tiwi_last_price_alerts';
        const THRESHOLD = 3; // Alert when change > 3%
        const TWC_THRESHOLD = 1; // Alert TWC at 1% change (more sensitive)
        const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per token

        try {
            // Load last alert timestamps
            const lastAlertsRaw = await AsyncStorage.getItem(ALERT_KEY);
            const lastAlerts: Record<string, number> = lastAlertsRaw ? JSON.parse(lastAlertsRaw) : {};
            const now = Date.now();
            let updated = false;

            for (const token of tokens) {
                const sym = (token.symbol || '').toUpperCase();
                const change = Math.abs(parseFloat(token.priceChange24h || '0'));
                const price = parseFloat(token.priceUSD || token.usdValue || '0');
                const isTWC = sym === 'TWC';
                const threshold = isTWC ? TWC_THRESHOLD : THRESHOLD;

                // Skip if below threshold
                if (change < threshold) continue;
                // Skip if price is 0
                if (price <= 0) continue;

                // Cooldown check
                const lastAlert = lastAlerts[sym] || 0;
                if (now - lastAlert < COOLDOWN_MS) continue;

                // Send alert
                await this.sendPriceAlert(sym, parseFloat(token.priceChange24h || '0'), price);
                lastAlerts[sym] = now;
                updated = true;
            }

            if (updated) {
                await AsyncStorage.setItem(ALERT_KEY, JSON.stringify(lastAlerts));
            }
        } catch (e) {
            console.warn('[NotificationService] Price alert check failed:', e);
        }
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

        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[NotificationService] Deactivate: Network unreachable.');
            } else {
                console.error('[NotificationService] Exception deactivating token:', error);
            }
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
