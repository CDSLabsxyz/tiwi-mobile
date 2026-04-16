/**
 * Background task service.
 *
 * Runs every ~15 minutes (OS-floor) to poll the active wallet for new
 * transactions and fire local notifications for anything the user hasn't
 * seen yet — so incoming txs notify even when the app is fully closed.
 *
 * IMPORTANT constraints (the OS, not us):
 *   • iOS decides if/when to run. Heuristic based on how often the user
 *     opens the app, device battery state, etc. No hard guarantees.
 *   • Android WorkManager enforces a 15-min minimum interval and obeys
 *     Doze/App-Standby. OEM skins (MIUI, EMUI, OneUI) may kill anyway.
 *   • Treat this as an opportunistic supplement to server push, not a
 *     replacement. The server-side crons in supabase/functions/* remain
 *     the primary delivery path.
 *
 * NOTE on native modules: expo-background-fetch and expo-task-manager
 * have native code. If the current native binary was built before these
 * packages were added, the imports throw "Cannot find native module".
 * We guard behind runtime require() so a stale binary logs a warning
 * instead of crashing the app. Rebuilding with `expo prebuild --clean`
 * + native rebuild restores full functionality.
 */

import { api } from '@/lib/mobile/api-client';
import { useWalletStore } from '@/store/walletStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export const BACKGROUND_TX_TASK = 'tiwi.background.tx-poll';

const LAST_SEEN_KEY = '@tiwi/bg-last-seen-tx';
const MIN_INTERVAL_SECONDS = 15 * 60;

// ─── Lazy native-module resolution ─────────────────────────────────────
// Guarded so a stale native binary (built before these packages were
// installed) logs a warning instead of throwing at import time.

let BackgroundFetch: any = null;
let TaskManager: any = null;
let nativeAvailable = false;

try {
    // Using require() so module evaluation stays inside the try/catch.
    // A missing native module surfaces here rather than at file load.
    BackgroundFetch = require('expo-background-fetch');
    TaskManager = require('expo-task-manager');
    nativeAvailable = !!(BackgroundFetch && TaskManager);
} catch (e) {
    console.warn(
        '[bg-tx-task] native modules unavailable — rebuild app with `expo prebuild --clean` to enable background tx polling.',
        e,
    );
}

interface LastSeenMap {
    // keyed by lower-case wallet address → the most recent tx hash we notified on
    [address: string]: string;
}

async function readLastSeen(): Promise<LastSeenMap> {
    try {
        const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

async function writeLastSeen(map: LastSeenMap) {
    try {
        await AsyncStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
    } catch {
        // best-effort; a failed write just means a duplicate notification next cycle
    }
}

function firstHash(txs: any[]): string | null {
    if (!Array.isArray(txs) || txs.length === 0) return null;
    const t = txs[0];
    return t?.transaction_hash || t?.txHash || t?.hash || null;
}

function describeTx(tx: any, walletLower: string): { title: string; body: string } | null {
    if (!tx) return null;

    const type = String(tx.transaction_type || tx.type || '').toLowerCase();
    const symbol = tx.to_token_symbol || tx.from_token_symbol || tx.symbol || '';
    const amount = tx.amount_formatted || tx.amount || '';
    const recipient = String(tx.recipient_address || tx.to || '').toLowerCase();
    const sender = String(tx.from_address || tx.from || '').toLowerCase();

    // Direction inference when the API doesn't tag it explicitly
    const inferredReceived = recipient === walletLower && sender !== walletLower;

    if (type.includes('receive') || inferredReceived) {
        return {
            title: 'Payment Received',
            body: symbol ? `You received ${amount} ${symbol}`.trim() : 'You received a new payment.',
        };
    }
    if (type.includes('send') || type.includes('sent')) {
        return {
            title: 'Transfer Sent',
            body: symbol ? `You sent ${amount} ${symbol}`.trim() : 'Your transfer was sent.',
        };
    }
    if (type.includes('swap')) {
        return {
            title: 'Swap Completed',
            body: symbol ? `Your ${symbol} swap completed.` : 'A swap completed.',
        };
    }
    return null;
}

// Define the task only when the native module is present. TaskManager
// requires `defineTask` to run at module top level before any register
// call fires, but calling it without the native module throws.
if (nativeAvailable) {
    const NewData = BackgroundFetch.BackgroundFetchResult?.NewData ?? 1;
    const NoData = BackgroundFetch.BackgroundFetchResult?.NoData ?? 2;
    const Failed = BackgroundFetch.BackgroundFetchResult?.Failed ?? 3;

    TaskManager.defineTask(BACKGROUND_TX_TASK, async () => {
        try {
            const { address } = useWalletStore.getState();
            if (!address) return NoData;

            const wallet = address.toLowerCase();
            const resp: any = await api.wallet.transactions({ address, limit: 10 }).catch(() => null);
            const txs: any[] = resp?.transactions || resp?.data || resp || [];
            const newestHash = firstHash(txs);
            if (!newestHash) return NoData;

            const lastSeen = await readLastSeen();
            const prev = lastSeen[wallet];

            if (prev === newestHash) return NoData;

            // First ever run for this wallet: record without spamming.
            if (!prev) {
                lastSeen[wallet] = newestHash;
                await writeLastSeen(lastSeen);
                return NewData;
            }

            // Walk forward until we find the previously-seen hash; everything
            // above it is new. Cap at 10 to match the fetch limit.
            const newOnes: any[] = [];
            for (const t of txs) {
                const h = t?.transaction_hash || t?.txHash || t?.hash;
                if (h === prev) break;
                newOnes.push(t);
            }

            for (const tx of newOnes.reverse()) {
                const desc = describeTx(tx, wallet);
                if (!desc) continue;
                try {
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: desc.title,
                            body: desc.body,
                            data: { type: 'transaction', source: 'background', hash: firstHash([tx]) },
                            sound: 'default',
                        },
                        trigger: null,
                    });
                } catch (e) {
                    console.warn('[bg-tx-task] notify failed', e);
                }
            }

            lastSeen[wallet] = newestHash;
            await writeLastSeen(lastSeen);

            return NewData;
        } catch (e) {
            console.warn('[bg-tx-task] error', e);
            return Failed;
        }
    });
}

export async function registerBackgroundTxTask(): Promise<void> {
    if (!nativeAvailable) return;
    try {
        const status = await BackgroundFetch.getStatusAsync();
        if (
            status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
            status === BackgroundFetch.BackgroundFetchStatus.Denied
        ) {
            console.warn('[bg-tx-task] background fetch not available:', status);
            return;
        }

        const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TX_TASK);
        if (already) return;

        await BackgroundFetch.registerTaskAsync(BACKGROUND_TX_TASK, {
            minimumInterval: MIN_INTERVAL_SECONDS,
            stopOnTerminate: false, // Android only
            startOnBoot: true,      // Android only
        });
    } catch (e) {
        console.warn('[bg-tx-task] register failed', e);
    }
}

export async function unregisterBackgroundTxTask(): Promise<void> {
    if (!nativeAvailable) return;
    try {
        const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TX_TASK);
        if (!already) return;
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TX_TASK);
    } catch (e) {
        console.warn('[bg-tx-task] unregister failed', e);
    }
}
