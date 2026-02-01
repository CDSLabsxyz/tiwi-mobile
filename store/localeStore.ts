/**
 * Locale Store
 * 
 * Manages language, currency, and regional formatting preferences.
 * Persisted to handle user preferences across app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

export interface Language {
    code: string;
    name: string;
    nativeName: string;
}

export interface Currency {
    code: string;
    name: string;
    symbol: string;
}

interface LocaleState {
    language: string;
    currency: string;
    region: string;
    dateFormat: DateFormat;

    // Supported lists
    languages: Language[];
    currencies: Currency[];

    // Actions
    setLanguage: (code: string) => void;
    setCurrency: (code: string) => void;
    setDateFormat: (format: DateFormat) => void;
    setRegion: (region: string) => void;
}

const SUPPORTED_LANGUAGES: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
    { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo' },
    { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa' },
];

const SUPPORTED_CURRENCIES: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
    { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
    { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
    { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
];

export const useLocaleStore = create<LocaleState>()(
    persist(
        (set) => ({
            language: 'en',
            currency: 'USD',
            region: 'US',
            dateFormat: 'MM/DD/YYYY',

            languages: SUPPORTED_LANGUAGES,
            currencies: SUPPORTED_CURRENCIES,

            setLanguage: (code) => set({ language: code }),
            setCurrency: (code) => set({ currency: code }),
            setDateFormat: (format) => set({ dateFormat: format }),
            setRegion: (region) => set({ region }),
        }),
        {
            name: 'tiwi-locale-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
