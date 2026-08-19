/**
 * Mobile sync protocol - the phone's half.
 *
 * MUST stay byte-identical to the extension's
 * `tiwi-wallet-core/src/lib/net/mobile-sync.ts`. Same code alphabet, same
 * domain-separated hashes, same AES-256-GCM framing. Changing one without the
 * other silently breaks pairing with a "wrong code" error, so both files carry
 * PROTOCOL_VERSION and both must move together.
 *
 * WHAT CROSSES: public addresses only. The extension never sends a seed, a
 * private key or a password, and this app stores what arrives as a WATCH-ONLY
 * view - it cannot sign for those accounts.
 *
 * The Supabase row used to carry it is a zero-knowledge dead-drop: it is found
 * by SHA-256 of the code and holds only ciphertext, so the relay never sees an
 * address or the code itself.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha256';

export const PROTOCOL_VERSION = 1;
export const SYNC_TTL_SECONDS = 120;

const TABLE = 'wallet_sync_sessions';

/** Crockford base32 without I, L, O, U - the characters people mistype. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;

export interface SyncAccount {
    chainId: string;
    chainName: string;
    address: string;
}

export interface SyncOffer {
    v: number;
    device: string;
    walletName: string;
    accounts: SyncAccount[];
}

export interface SyncResponse {
    v: number;
    device: string;
    approvedAt: number;
}

// ---- Code, lookup and key -------------------------------------------------

export function normalizeSyncCode(raw: string): string {
    return (raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function formatSyncCode(code: string): string {
    const c = normalizeSyncCode(code);
    return c.length === CODE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function isValidSyncCode(raw: string): boolean {
    const code = normalizeSyncCode(raw);
    return code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));
}

const utf8 = (text: string) => new TextEncoder().encode(text);

function hex(bytes: Uint8Array): string {
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function deriveLookup(code: string): string {
    return hex(sha256(utf8(`tiwi-sync-v${PROTOCOL_VERSION}:lookup:${normalizeSyncCode(code)}`)));
}

function deriveKey(code: string): Uint8Array {
    return sha256(utf8(`tiwi-sync-v${PROTOCOL_VERSION}:key:${normalizeSyncCode(code)}`));
}

// ---- Payload encryption ---------------------------------------------------

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return globalThis.btoa(binary);
}

function fromBase64(text: string): Uint8Array {
    const binary = globalThis.atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
}

function randomBytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    globalThis.crypto.getRandomValues(out);
    return out;
}

/** nonce(12) || AES-256-GCM(ciphertext || tag), base64. */
export function encryptPayload(code: string, payload: unknown): string {
    const nonce = randomBytes(12);
    const sealed = gcm(deriveKey(code), nonce).encrypt(utf8(JSON.stringify(payload)));
    const out = new Uint8Array(nonce.length + sealed.length);
    out.set(nonce, 0);
    out.set(sealed, nonce.length);
    return toBase64(out);
}

/** Null on a wrong code or any tampering - GCM makes those the same failure. */
export function decryptPayload<T>(code: string, blob: string): T | null {
    try {
        const raw = fromBase64(blob);
        const plain = gcm(deriveKey(code), raw.slice(0, 12)).decrypt(raw.slice(12));
        return JSON.parse(new TextDecoder().decode(plain)) as T;
    } catch {
        return null;
    }
}

// ---- Relay ----------------------------------------------------------------

const RELAY_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const RELAY_KEY =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || '';

export function isRelayConfigured(): boolean {
    return Boolean(RELAY_URL && RELAY_KEY);
}

function relayHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
        apikey: RELAY_KEY,
        Authorization: `Bearer ${RELAY_KEY}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

export class SyncRelayError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SyncRelayError';
    }
}

/** Reasons a pairing can fail, so the UI can say something specific. */
export type FetchOfferResult =
    | { ok: true; offer: SyncOffer }
    | { ok: false; reason: 'not-found' | 'expired' | 'bad-code' | 'relay'; message: string };

/**
 * Look up the extension's offer for `code` and decrypt it.
 *
 * A code that was never issued and a code that was mistyped are deliberately
 * reported differently - the first is "expired or already used", the second is
 * "that code is not right" - because they need different things from the user.
 */
export async function fetchSyncOffer(code: string): Promise<FetchOfferResult> {
    if (!isRelayConfigured()) {
        return { ok: false, reason: 'relay', message: 'Mobile sync is not configured in this build.' };
    }
    if (!isValidSyncCode(code)) {
        return { ok: false, reason: 'bad-code', message: 'That pairing code is not valid.' };
    }

    const lookup = deriveLookup(code);
    let rows: Array<{ offer: string; expires_at: string }>;
    try {
        const res = await fetch(
            `${RELAY_URL}/rest/v1/${TABLE}?lookup=eq.${lookup}&select=offer,expires_at`,
            { headers: relayHeaders() }
        );
        if (!res.ok) {
            const detail = (await res.text()).slice(0, 200);
            if (res.status === 404 || detail.includes('PGRST205')) {
                return {
                    ok: false,
                    reason: 'relay',
                    message: 'Mobile sync is not set up on the server yet.',
                };
            }
            return { ok: false, reason: 'relay', message: `Sync server error (${res.status}).` };
        }
        rows = await res.json();
    } catch (error: any) {
        return { ok: false, reason: 'relay', message: error?.message || 'Network unreachable.' };
    }

    const row = rows[0];
    if (!row) {
        return {
            ok: false,
            reason: 'not-found',
            message: 'That code has expired or was already used. Generate a new one.',
        };
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
        return { ok: false, reason: 'expired', message: 'That pairing code has expired.' };
    }

    const offer = decryptPayload<SyncOffer>(code, row.offer);
    if (!offer || offer.v !== PROTOCOL_VERSION) {
        return {
            ok: false,
            reason: 'bad-code',
            message: offer
                ? 'That extension is running a different sync version. Update both apps.'
                : 'That pairing code is not right.',
        };
    }

    return { ok: true, offer };
}

/**
 * Tell the extension the user approved. Written encrypted, so the relay learns
 * nothing beyond "this pairing completed".
 */
export async function approveSyncSession(code: string, deviceName: string): Promise<boolean> {
    if (!isRelayConfigured()) return false;

    const response: SyncResponse = {
        v: PROTOCOL_VERSION,
        device: deviceName,
        approvedAt: Date.now(),
    };

    try {
        const res = await fetch(`${RELAY_URL}/rest/v1/${TABLE}?lookup=eq.${deriveLookup(code)}`, {
            method: 'PATCH',
            headers: relayHeaders({ Prefer: 'return=minimal' }),
            body: JSON.stringify({ response: encryptPayload(code, response) }),
        });
        return res.ok;
    } catch {
        return false;
    }
}
