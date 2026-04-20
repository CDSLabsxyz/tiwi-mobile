/**
 * Translation Service (React Native).
 *
 * Mirrors the web app's `lib/i18n/translation-service.ts` but:
 *  - Persists cache to AsyncStorage (not localStorage).
 *  - Calls the MyMemory public endpoint directly instead of a Next.js
 *    `/api/v1/translate` proxy route, which doesn't exist in RN.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TranslationKey } from './translations';

const TRANSLATION_CACHE_KEY_PREFIX = 'tiwi_translation_';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedTranslation {
    text: string;
    timestamp: number;
    language: string;
}

async function getCachedTranslation(
    key: TranslationKey,
    language: string,
): Promise<string | null> {
    try {
        const cacheKey = `${TRANSLATION_CACHE_KEY_PREFIX}${language}_${key}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached) return null;

        const data: CachedTranslation = JSON.parse(cached);
        if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
            AsyncStorage.removeItem(cacheKey).catch(() => { });
            return null;
        }
        return data.text;
    } catch {
        return null;
    }
}

async function cacheTranslation(
    key: TranslationKey,
    language: string,
    text: string,
): Promise<void> {
    try {
        const cacheKey = `${TRANSLATION_CACHE_KEY_PREFIX}${language}_${key}`;
        const data: CachedTranslation = { text, timestamp: Date.now(), language };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.warn('[TranslationService] Failed to cache translation:', error);
    }
}

interface MyMemoryResponse {
    responseData?: { translatedText: string };
    responseStatus?: number;
    responseDetails?: string;
}

async function translateViaAPI(text: string, targetLang: string): Promise<string> {
    // `|` must be pre-encoded — see comment in autoTranslate.ts for why
    // leaving it raw causes RN's fetch to re-encode the whole query.
    const url =
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(text) +
        '&langpair=en' +
        encodeURIComponent('|') +
        targetLang;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Translation API error: ${response.statusText}`);
    }
    const data: MyMemoryResponse = await response.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
    }
    throw new Error(data.responseDetails || 'Translation failed');
}

export async function getTranslationAsync(
    key: TranslationKey,
    language: string,
    fallbackText: string,
): Promise<string> {
    const normalizedLang = language.split('-')[0].toLowerCase();
    if (normalizedLang === 'en') return fallbackText;

    const cached = await getCachedTranslation(key, normalizedLang);
    if (cached) return cached;

    try {
        const translatedText = await translateViaAPI(fallbackText, normalizedLang);
        cacheTranslation(key, normalizedLang, translatedText).catch(() => { });
        return translatedText;
    } catch (error) {
        console.error(
            `[TranslationService] Failed to translate ${key} to ${normalizedLang}:`,
            error,
        );
        return fallbackText;
    }
}
