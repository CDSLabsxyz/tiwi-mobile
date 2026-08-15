/**
 * Extension Link Service
 *
 * Pairs this device with TIWI Wallet Core - the browser extension in
 * `tiwi-wallet-core`. The extension's "Mobile sync" screen renders a QR code
 * carrying `tiwi://mobile-sync?code=<nonce>&expires=<epoch-ms>`; the mobile app
 * scans it, checks it hasn't expired, and records the pairing.
 *
 * NOTE: the extension side currently only displays the code and waits - there
 * is no server-side handshake to complete yet, so `linkExtension` records the
 * pairing locally. When the sync endpoint exists, that is the single place to
 * post the code from.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

/** Returns null when `raw` is not a TIWI extension mobile-sync QR payload. */
export function parseExtensionSyncPayload(raw: string): ExtensionSyncPayload | null {
    const match = SYNC_URI_REGEX.exec(raw.trim());
    if (!match) return null;

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
        code,
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

/**
 * Records a scanned pairing. Re-scanning an already linked extension refreshes
 * it in place rather than adding a duplicate row.
 */
export async function linkExtension(payload: ExtensionSyncPayload): Promise<ExtensionLink> {
    const link: ExtensionLink = {
        code: payload.code,
        label: 'TIWI Wallet Core',
        linkedAt: Date.now(),
    };

    const existing = await getExtensionLinks();
    const next = [link, ...existing.filter((l) => l.code !== link.code)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return link;
}

export async function unlinkExtension(code: string): Promise<void> {
    const existing = await getExtensionLinks();
    await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(existing.filter((l) => l.code !== code))
    );
}
