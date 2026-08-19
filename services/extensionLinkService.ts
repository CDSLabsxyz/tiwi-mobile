/**
 * Extension Link Service
 *
 * Pairs this device with TIWI Wallet Core - the browser extension in
 * `tiwi-wallet-core`. The extension's "Mobile sync" screen shows a QR carrying
 * `tiwi://mobile-sync?code=<code>&expires=<epoch-ms>` and prints the same code
 * for typing by hand; either route ends up here.
 *
 * The handshake is real now: this app fetches the extension's encrypted offer
 * from the relay, decrypts it with the code, stores the addresses, and writes
 * an encrypted approval back so the extension's screen can say "paired".
 * See `extensionSyncProtocol.ts` for the wire format.
 *
 * WHAT IS STORED: public addresses. This is a WATCH-ONLY link - the extension
 * never sends keys and this app cannot sign for the accounts it shows here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    approveSyncSession,
    fetchSyncOffer,
    isValidSyncCode,
    normalizeSyncCode,
    type SyncAccount,
} from './extensionSyncProtocol';

const STORAGE_KEY = '@tiwi/extension-links';

/** `tiwi://` is what the extension emits; `tiwiprotocol://` is this app's own scheme. */
const SYNC_URI_REGEX = /^(?:tiwi|tiwiprotocol):\/\/mobile-sync\?(.+)$/i;

export interface ExtensionSyncPayload {
    code: string;
    /** Epoch ms. `null` when the QR carried no expiry. */
    expiresAt: number | null;
}

export interface ExtensionLink {
    code: string;
    label: string;
    linkedAt: number;
    /** The wallet this extension shared, and its public addresses. */
    walletName?: string;
    accounts?: SyncAccount[];
}

/**
 * Accepts either a scanned `tiwi://mobile-sync?...` URI or a bare code typed by
 * hand, so the manual entry box and the camera feed the same path.
 */
export function parseExtensionSyncPayload(raw: string): ExtensionSyncPayload | null {
    const text = (raw ?? '').trim();
    if (!text) return null;

    const match = SYNC_URI_REGEX.exec(text);
    if (!match) {
        // Bare code - what someone types when the camera is not an option.
        return isValidSyncCode(text) ? { code: normalizeSyncCode(text), expiresAt: null } : null;
    }

    const params = new Map<string, string>();
    for (const pair of match[1].split('&')) {
        const eq = pair.indexOf('=');
        if (eq <= 0) continue;
        params.set(
            decodeURIComponent(pair.slice(0, eq)).toLowerCase(),
            decodeURIComponent(pair.slice(eq + 1))
        );
    }

    const code = params.get('code');
    if (!code) return null;

    const expires = Number(params.get('expires'));
    return {
        code: normalizeSyncCode(code),
        expiresAt: Number.isFinite(expires) && expires > 0 ? expires : null,
    };
}

export function isSyncPayloadExpired(payload: ExtensionSyncPayload): boolean {
    return payload.expiresAt !== null && payload.expiresAt <= Date.now();
}

export async function getExtensionLinks(): Promise<ExtensionLink[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('[ExtensionLink] Failed to read links:', error);
        return [];
    }
}

export type LinkResult =
    | { ok: true; link: ExtensionLink }
    | { ok: false; message: string };

/**
 * Complete a pairing.
 *
 * Order matters: the offer is fetched and stored BEFORE the approval is sent
 * back, so the extension can never show "paired" for a link this device failed
 * to record.
 */
export async function completeExtensionLink(
    payload: ExtensionSyncPayload,
    deviceName: string
): Promise<LinkResult> {
    const result = await fetchSyncOffer(payload.code);
    if (!result.ok) return { ok: false, message: result.message };

    const link: ExtensionLink = {
        code: payload.code,
        label: result.offer.device || 'TIWI Wallet Core',
        walletName: result.offer.walletName,
        accounts: result.offer.accounts,
        linkedAt: Date.now(),
    };

    const existing = await getExtensionLinks();
    const next = [link, ...existing.filter((l) => l.code !== link.code)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    // Best effort: the link is already saved here, so a failed approval only
    // means the extension's screen keeps waiting until its code expires.
    await approveSyncSession(payload.code, deviceName);

    return { ok: true, link };
}

export async function unlinkExtension(code: string): Promise<void> {
    const existing = await getExtensionLinks();
    await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(existing.filter((l) => l.code !== code))
    );
}
