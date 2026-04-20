/**
 * Auto-translate: React-Native equivalent of the web app's LiveTranslator.
 *
 * Synchronously returns a cached translation for an arbitrary English string,
 * or the original string if no translation is cached yet. In that case it
 * kicks off a background fetch to the MyMemory API, stores the result in
 * AsyncStorage + an in-memory cache, then bumps a Zustand version counter so
 * every subscribed <Text> re-renders and picks up the translation.
 *
 * Mirrors the LiveTranslator's localStorage cache and batching logic, adapted
 * to RN (no DOM walker — we hook the Text component itself in
 * `installGlobalTranslate.ts`).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

// Bump the suffix (`v2`) to invalidate older caches — an earlier build
// stored double-encoded garbage (e.g. "管理%20代币") into v1; we don't want to
// keep reading that back on startup.
const STORAGE_PREFIX = 'tiwi_autotrans_v2_';
const LEGACY_STORAGE_PREFIX = 'tiwi_autotrans_';
const MAX_TEXT_LENGTH = 500;

/**
 * MyMemory sometimes returns its quota / error messages inside
 * `translatedText` with a 200 status. Reject those so they don't pollute
 * the cache and render as translations.
 */
function isMyMemoryErrorMessage(text: string): boolean {
    if (!text) return true;
    const lower = text.toLowerCase();
    if (lower.includes('mymemory warning')) return true;
    if (lower.includes('no query specified')) return true;
    if (lower.includes('invalid target language')) return true;
    if (lower.includes('quota finished')) return true;
    if (lower.includes('used all available free translations')) return true;
    // Garbage from the old double-encoding bug — any `%XX` percent-escape
    // sequence in a translated UI label is almost certainly MyMemory echoing
    // back double-encoded input. Catches %20 (space), %24 ($), %27 ('),
    // %2C (,), etc.
    if (/%[0-9A-Fa-f]{2}/.test(text)) return true;
    return false;
}

// In-memory cache. Key = `${lang}:${englishText}`, value = translated text.
const memCache = new Map<string, string>();

// Tracks in-flight requests so we don't fetch the same key twice concurrently.
const pending = new Set<string>();

// Tracks strings we already tried and failed to translate, to avoid
// hammering the API with re-requests every render.
const failed = new Set<string>();

interface AutoTranslateState {
    version: number;
    bump: () => void;
}

/**
 * Global version counter. Every time a new translation lands in the cache we
 * increment it — components that subscribe (via the patched Text render)
 * re-render and re-call `autoTranslate`, which now returns the cached value.
 */
export const useAutoTranslateStore = create<AutoTranslateState>((set) => ({
    version: 0,
    bump: () => set((s) => ({ version: s.version + 1 })),
}));

/**
 * Coalesce version bumps — if 40 translations come back in the same tick we
 * only want one re-render wave, not 40.
 */
let bumpScheduled = false;
function scheduleBump() {
    if (bumpScheduled) return;
    bumpScheduled = true;
    setTimeout(() => {
        bumpScheduled = false;
        useAutoTranslateStore.getState().bump();
    }, 120);
}

/**
 * Decide whether a string is worth sending to the translator. We skip:
 *  - Empty/whitespace or very short strings (under 3 chars)
 *  - Pure numbers, percentages, monetary amounts
 *  - Crypto addresses, URLs, emails
 *  - ALL-CAPS tokens/tickers under 8 chars (BTC, ETH, PEPE, …)
 *  - Strings that already contain non-Latin characters (likely already
 *    translated by a hard-coded localized string)
 *  - Anything longer than 500 chars (unlikely UI label, probably data)
 */
function shouldTranslate(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > MAX_TEXT_LENGTH) return false;

    // Numbers, percentages, monetary values, signs.
    if (/^[\s\d.,+\-$€£¥₹₦%:/x()]+$/.test(trimmed)) return false;

    // Crypto addresses (0x…), URLs, emails.
    if (/^0x[a-fA-F0-9]{4,}/.test(trimmed)) return false;
    if (/^https?:\/\//i.test(trimmed)) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;

    // ALL CAPS tickers / acronyms (≤ 8 chars, no spaces).
    if (/^[A-Z0-9_\-]{1,8}$/.test(trimmed)) return false;

    // Must contain at least one ASCII letter — otherwise assume it's already
    // in the target script (CJK, Arabic, Cyrillic, etc.).
    if (!/[a-zA-Z]/.test(trimmed)) return false;

    return true;
}

async function fetchTranslation(text: string, targetLang: string): Promise<void> {
    const cacheKey = `${targetLang}:${text}`;
    if (memCache.has(cacheKey) || pending.has(cacheKey) || failed.has(cacheKey)) return;
    pending.add(cacheKey);

    try {
        const storageKey = STORAGE_PREFIX + cacheKey;
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
            memCache.set(cacheKey, stored);
            scheduleBump();
            return;
        }

        // Pre-encode every reserved character ourselves. The previous
        // construction left a raw `|` in the URL (`langpair=en|zh`), which
        // RN's fetch URL normalizer treated as invalid and re-encoded the
        // whole query — turning our `%20` into `%2520` and producing
        // garbage like `管理%20代币` on the server side.
        const url =
            'https://api.mymemory.translated.net/get?q=' +
            encodeURIComponent(text) +
            '&langpair=en' +
            encodeURIComponent('|') +
            targetLang;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            const translated: string = data.responseData.translatedText;
            if (isMyMemoryErrorMessage(translated)) {
                failed.add(cacheKey);
            } else {
                memCache.set(cacheKey, translated);
                AsyncStorage.setItem(storageKey, translated).catch(() => { });
                scheduleBump();
            }
        } else {
            failed.add(cacheKey);
        }
    } catch {
        failed.add(cacheKey);
    } finally {
        pending.delete(cacheKey);
    }
}

/**
 * Synchronously return the translation for `text` in `targetLang`, or the
 * original text if none is cached yet. Kicks off a background fetch when the
 * cache misses — the calling Text will re-render once the fetch lands.
 */
export function autoTranslate(text: string, targetLang: string | null | undefined): string {
    if (!text || typeof text !== 'string') return text;
    const lang = (targetLang || '').split('-')[0].toLowerCase();
    if (!lang || lang === 'en') return text;
    if (!shouldTranslate(text)) return text;

    const cacheKey = `${lang}:${text}`;
    const cached = memCache.get(cacheKey);
    if (cached) {
        // Defensive: if a garbage value slipped into the cache from an older
        // build (double-encoded text with literal %20, %24, etc.), drop it
        // now and trigger a fresh fetch instead of rendering the garbage.
        if (isMyMemoryErrorMessage(cached)) {
            memCache.delete(cacheKey);
            AsyncStorage.removeItem(STORAGE_PREFIX + cacheKey).catch(() => { });
            // Don't mark as failed — let the next render re-fetch cleanly.
            fetchTranslation(text, lang);
            return text;
        }
        return cached;
    }

    // Fire and forget — re-renders pick up the translation later via the
    // version bump.
    fetchTranslation(text, lang);
    return text;
}

/**
 * Preload the AsyncStorage cache into memory on app start so translations
 * are available synchronously from the first render.
 */
export async function preloadAutoTranslateCache(): Promise<void> {
    try {
        const keys = await AsyncStorage.getAllKeys();

        // Purge anything stored under the legacy prefix — it may contain the
        // double-encoded garbage from the previous build.
        const legacyKeys = keys.filter(
            (k) => k.startsWith(LEGACY_STORAGE_PREFIX) && !k.startsWith(STORAGE_PREFIX),
        );
        if (legacyKeys.length > 0) {
            AsyncStorage.multiRemove(legacyKeys).catch(() => { });
        }

        const ourKeys = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
        if (ourKeys.length === 0) return;
        const entries = await AsyncStorage.multiGet(ourKeys);
        const badKeys: string[] = [];
        for (const [storageKey, value] of entries) {
            if (!value) continue;
            if (isMyMemoryErrorMessage(value)) {
                badKeys.push(storageKey);
                continue;
            }
            const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
            memCache.set(cacheKey, value);
        }
        if (badKeys.length > 0) {
            AsyncStorage.multiRemove(badKeys).catch(() => { });
        }
        useAutoTranslateStore.getState().bump();
    } catch {
        // Ignore — we'll populate lazily via fetches.
    }
}
