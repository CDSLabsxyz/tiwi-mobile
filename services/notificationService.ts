import { supabase } from '@/lib/supabase';
import { useWalletStore } from '@/store/walletStore';
import { api } from '@/lib/mobile/api-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
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

// AsyncStorage keys used by the price-alert pipeline.
// Kept together so the settings UI and the service stay in sync.
export const PRICE_ALERT_PREFS_KEY = 'tiwi_price_alert_prefs';
const PRICE_BASELINES_KEY = 'tiwi_price_baselines';

interface PriceAlertPrefs {
    enabled: boolean;
    threshold_percent: number; // e.g. 3 = alert at ±3% from baseline
    cooldown_minutes: number;  // min time between alerts for the same token
}

const DEFAULT_PREFS: PriceAlertPrefs = {
    enabled: true,
    threshold_percent: 3,
    cooldown_minutes: 60,
};

class NotificationService {
    private initialized = false;

    /**
     * One-shot startup: install the Android channel, request permissions, and
     * make sure the foreground handler is live. Safe to call without a wallet
     * address — registration of the push token still happens later in
     * `registerForPushNotifications` once the user is signed in.
     */
    async initNotifications(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
        try {
            // Android: the 'default' channel must exist *before* a notification
            // is scheduled, otherwise it falls back to a low-priority channel
            // that never shows as a heads-up.
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#B1F128',
                    sound: 'default',
                });
            }

            // Request permission if not already granted so local notifications
            // actually display on iOS. We do not block app startup on this.
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                await Notifications.requestPermissionsAsync();
            }
        } catch (e) {
            console.warn('[NotificationService] initNotifications failed:', e);
        }
    }

    /**
     * Read user price-alert preferences from the local AsyncStorage cache.
     * The settings UI mirrors its Supabase writes to this key so the service
     * can make synchronous decisions without a network round-trip.
     */
    private async loadPriceAlertPrefs(): Promise<PriceAlertPrefs> {
        try {
            const raw = await AsyncStorage.getItem(PRICE_ALERT_PREFS_KEY);
            if (!raw) return DEFAULT_PREFS;
            const parsed = JSON.parse(raw);
            return {
                enabled: parsed.enabled !== false,
                threshold_percent: Number(parsed.threshold_percent) || DEFAULT_PREFS.threshold_percent,
                cooldown_minutes: Number(parsed.cooldown_minutes) || DEFAULT_PREFS.cooldown_minutes,
            };
        } catch {
            return DEFAULT_PREFS;
        }
    }

    /**
     * Fire a test price-alert notification. Used by the settings UI so the
     * user can verify the pipeline end-to-end without waiting for the market
     * to move.
     */
    async sendTestPriceAlert(): Promise<void> {
        await this.initNotifications();
        await this.sendPriceAlert('TWC', 4.21, 0.3421);
    }
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

            // Android needs the channel created BEFORE the token is fetched
            // for high-importance heads-up notifications to work.
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#B1F128',
                    sound: 'default',
                });
            }

            // EAS projectId is required for SDK 49+ getExpoPushTokenAsync.
            const projectId =
                (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
                (Constants as any)?.easConfig?.projectId;

            token = (
                await Notifications.getExpoPushTokenAsync(
                    projectId ? { projectId } : undefined,
                )
            ).data;

            if (token) {
                await this.saveTokenToBackend(address, token);
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
     * Save/Update the Expo push token directly in Supabase. The
     * `notifications` insert trigger inside Postgres handles fan-out
     * to Expo's push relay — no backend round-trip needed.
     */
    private async saveTokenToBackend(walletAddress: string, token: string) {
        try {
            const { error } = await supabase
                .from('user_push_tokens')
                .upsert(
                    {
                        user_wallet: walletAddress.toLowerCase(),
                        push_token: token,
                        device_type: Platform.OS,
                        device_name: Device.modelName || 'Unknown Device',
                        is_active: true,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'push_token' },
                );
            if (error) console.warn('[NotificationService] saveToken supabase error:', error.message);
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[NotificationService] SaveToken: Network unreachable.');
            } else {
                console.error('[NotificationService] Exception saving token:', error);
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
     * Check wallet tokens for significant price movement and send alerts.
     *
     * Uses a per-token baseline snapshot (persisted in AsyncStorage) and
     * compares the current unit price against it. When |delta| crosses the
     * user-configured threshold AND the cooldown has elapsed, an alert is
     * sent and the baseline is reset to the current price — so each alert
     * represents a fresh move rather than a lingering 24h value.
     *
     * First-seen tokens simply have their baseline recorded silently.
     */
    async checkPriceAlerts(tokens: any[]) {
        try {
            const prefs = await this.loadPriceAlertPrefs();
            if (!prefs.enabled) return;

            const threshold = Math.max(0.01, prefs.threshold_percent);
            const cooldownMs = Math.max(1, prefs.cooldown_minutes) * 60 * 1000;

            // Always track these majors even if the wallet doesn't hold them
            const ALWAYS_TRACK = ['BTC', 'ETH', 'BNB', 'TWC'];
            // Never alert on stablecoins — they barely move and spam notifications
            const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDP', 'GUSD', 'LUSD', 'FDUSD', 'PYUSD']);

            const baselinesRaw = await AsyncStorage.getItem(PRICE_BASELINES_KEY);
            const baselines: Record<string, { price: number; ts: number }> =
                baselinesRaw ? JSON.parse(baselinesRaw) : {};
            const now = Date.now();
            let mutated = false;

            // Build combined list: wallet tokens + always-tracked majors (deduped by symbol)
            const seenSymbols = new Set<string>();
            const tokenList: Array<{ symbol: string; priceUSD?: string; balanceFormatted?: string; usdValue?: string }> = [];

            for (const t of tokens) {
                const sym = (t.symbol || '').toUpperCase();
                if (!sym || seenSymbols.has(sym)) continue;
                seenSymbols.add(sym);
                tokenList.push(t);
            }

            // Fetch live prices for always-tracked majors not already in the wallet list
            for (const major of ALWAYS_TRACK) {
                if (seenSymbols.has(major)) continue;
                try {
                    const resp = await api.market.list({ limit: 50 });
                    const markets = resp?.markets || [];
                    const match = markets.find((m: any) => m.symbol?.toUpperCase() === major);
                    if (match?.price) {
                        tokenList.push({ symbol: major, priceUSD: String(match.price) });
                        seenSymbols.add(major);
                    }
                } catch {}
            }

            for (const token of tokenList) {
                const sym = (token.symbol || '').toUpperCase();
                if (!sym) continue;
                if (STABLECOINS.has(sym)) continue; // Skip USDT, USDC, etc.

                let price = parseFloat(token.priceUSD || '0');
                if (!price || price <= 0) {
                    const bal = parseFloat(token.balanceFormatted || '0');
                    const usd = parseFloat(token.usdValue || '0');
                    if (bal > 0 && usd > 0) price = usd / bal;
                }
                if (!price || price <= 0) continue;

                const prev = baselines[sym];
                if (!prev) {
                    baselines[sym] = { price, ts: now };
                    mutated = true;
                    continue;
                }

                const deltaPct = ((price - prev.price) / prev.price) * 100;
                const absDelta = Math.abs(deltaPct);

                if (absDelta < threshold) continue;
                if (now - prev.ts < cooldownMs) continue;

                await this.sendPriceAlert(sym, deltaPct, price);
                baselines[sym] = { price, ts: now };
                mutated = true;
            }

            if (mutated) {
                await AsyncStorage.setItem(PRICE_BASELINES_KEY, JSON.stringify(baselines));
            }
        } catch (e) {
            console.warn('[NotificationService] Price alert check failed:', e);
        }
    }

    /**
     * Sync the user's currently held tokens to Supabase so the server-side
     * price-alert cron knows what to watch. Idempotent — upserts on the
     * unique key (user_wallet, chain_id, token_address). Stale rows for
     * tokens the user no longer holds are deleted in the same call.
     */
    async syncWatchedTokens(walletAddress: string, tokens: any[]) {
        if (!walletAddress || !tokens || tokens.length === 0) return;
        try {
            const wallet = walletAddress.toLowerCase();
            const rows = tokens
                .filter(t => t.symbol && (t.address || t.contractAddress) && t.chainId)
                .map(t => ({
                    user_wallet: wallet,
                    chain_id: Number(t.chainId),
                    token_address: String(t.address || t.contractAddress).toLowerCase(),
                    symbol: String(t.symbol).toUpperCase(),
                    updated_at: new Date().toISOString(),
                }));

            if (rows.length === 0) return;

            const { error: upsertErr } = await supabase
                .from('user_watched_tokens')
                .upsert(rows, { onConflict: 'user_wallet,chain_id,token_address' });
            if (upsertErr) {
                console.warn('[NotificationService] syncWatchedTokens upsert error:', upsertErr.message);
                return;
            }

            // Prune rows the user no longer holds. Delete watched-token rows
            // for this wallet that aren't in the current `rows` set.
            const keepKeys = new Set(rows.map(r => `${r.chain_id}:${r.token_address}`));
            const { data: existing } = await supabase
                .from('user_watched_tokens')
                .select('chain_id, token_address')
                .eq('user_wallet', wallet);
            const toDelete = (existing || []).filter(
                r => !keepKeys.has(`${r.chain_id}:${String(r.token_address).toLowerCase()}`),
            );
            for (const r of toDelete) {
                await supabase
                    .from('user_watched_tokens')
                    .delete()
                    .match({ user_wallet: wallet, chain_id: r.chain_id, token_address: r.token_address });
            }
        } catch (e: any) {
            if (e?.message?.includes('Network request failed')) {
                console.warn('[NotificationService] syncWatchedTokens: Network unreachable.');
            } else {
                console.error('[NotificationService] syncWatchedTokens exception:', e);
            }
        }
    }

    /**
     * Deactivate a token (e.g. on logout)
     */
    async deactivateToken(token: string) {
        try {
            const { error } = await supabase
                .from('user_push_tokens')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('push_token', token);
            if (error) console.warn('[NotificationService] deactivate supabase error:', error.message);
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

export async function initNotifications() {
    return notificationService.initNotifications();
}

export async function sendTestPriceAlert() {
    return notificationService.sendTestPriceAlert();
}
