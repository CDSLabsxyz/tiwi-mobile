/**
 * Locale store: language, region, currency, date format.
 *
 * Mirrors the web app's `lib/locale/locale-store.ts`: language drives region,
 * currency, and dateFormat via `getLocaleFromLanguage`. Persisted with
 * AsyncStorage so selections survive app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getLocaleFromLanguage, type DateFormatType } from '@/lib/locale/language-to-region';

export type DateFormat = DateFormatType;

interface LocaleState {
    language: string;
    region: string;
    currency: string;
    dateFormat: DateFormatType;

    /** Set language and auto-derive region, currency, and dateFormat. */
    setLanguage: (code: string) => void;
    /** Apply language (region/currency/format auto-derived). */
    applySettings: (languageCode: string) => void;
    /** BCP 47 locale string for Intl (e.g. en-US). */
    getLocale: () => string;
}

const STORAGE_KEY = 'tiwi-locale-storage';
const DEFAULT_LANGUAGE = 'en';

function getDefaults() {
    const locale = getLocaleFromLanguage(DEFAULT_LANGUAGE);
    return {
        language: locale.languageCode,
        region: locale.regionCode,
        currency: locale.currency,
        dateFormat: locale.dateFormat,
    };
}

export const useLocaleStore = create<LocaleState>()(
    persist(
        (set, get) => ({
            ...getDefaults(),

            setLanguage: (code) => {
                const locale = getLocaleFromLanguage(code);
                set({
                    language: locale.languageCode,
                    region: locale.regionCode,
                    currency: locale.currency,
                    dateFormat: locale.dateFormat,
                });
            },

            applySettings: (languageCode) => {
                const locale = getLocaleFromLanguage(languageCode);
                set({
                    language: locale.languageCode,
                    region: locale.regionCode,
                    currency: locale.currency,
                    dateFormat: locale.dateFormat,
                });
            },

            getLocale: () => {
                const { language, region } = get();
                return `${language}-${region}`;
            },
        }),
        {
            name: STORAGE_KEY,
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (s) => ({
                language: s.language,
                region: s.region,
                currency: s.currency,
                dateFormat: s.dateFormat,
            }),
        },
    ),
);
