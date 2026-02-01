/**
 * Currency Service
 * 
 * Handles real-time currency conversion, number formatting, and date localization.
 * Synchronizes exchange rates with a public API and persists them for offline usage.
 */

import { formatCompactNumber, formatPriceWithSubscript } from '@/utils/formatting';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocaleStore } from '../store/localeStore';

const EXCHANGE_RATES_KEY = 'tiwi_exchange_rates';
const CACHE_EXPIRY = 1000 * 60 * 60; // 1 Hour

interface ExchangeRates {
    rates: Record<string, number>;
    timestamp: number;
}

const STATIC_FALLBACK: Record<string, number> = {
    USD: 1.0,
    NGN: 1550.0,
    EUR: 0.92,
    GBP: 0.79,
    GHS: 12.5,
    KES: 132.0,
    ZAR: 18.8,
    CNY: 7.23,
    JPY: 151.5,
    CAD: 1.36,
    AUD: 1.52,
    INR: 83.3,
    AED: 3.67,
    BRL: 4.98,
    RUB: 92.5,
    TRY: 32.1,
};

class CurrencyService {
    private ratesCache: ExchangeRates | null = null;

    async init() {
        try {
            const stored = await AsyncStorage.getItem(EXCHANGE_RATES_KEY);
            if (stored) {
                const parsed: ExchangeRates = JSON.parse(stored);
                const isExpired = Date.now() - parsed.timestamp > CACHE_EXPIRY;
                if (!isExpired) {
                    this.ratesCache = parsed;
                    return;
                }
            }
            await this.refreshRates();
        } catch (error) {
            this.ratesCache = { rates: STATIC_FALLBACK, timestamp: Date.now() };
        }
    }

    async refreshRates(): Promise<Record<string, number>> {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();

            const newRates: ExchangeRates = {
                rates: { ...STATIC_FALLBACK, ...data.rates },
                timestamp: Date.now(),
            };

            this.ratesCache = newRates;
            await AsyncStorage.setItem(EXCHANGE_RATES_KEY, JSON.stringify(newRates));
            return newRates.rates;
        } catch (error) {
            return this.ratesCache?.rates || STATIC_FALLBACK;
        }
    }

    convert(amount: number, targetCurrency: string): number {
        const rates = this.ratesCache?.rates || STATIC_FALLBACK;
        const rate = rates[targetCurrency] || 1;
        return amount * rate;
    }

    /**
     * Formats a value with the correct currency symbol and regional formatting (commas/dots)
     */
    format(value: number, currencyCode: string): string {
        const localeStore = useLocaleStore.getState();
        const { language } = localeStore;

        // Find the currency metadata to get the symbol
        const currencyMetadata = localeStore.currencies.find(c => c.code === currencyCode);
        const symbol = currencyMetadata?.symbol || currencyCode;

        // For large values (>= 10,000), use compact notation (K, M, B, T)
        if (value >= 10000) {
            return formatCompactNumber(value, {
                symbol: symbol,
                decimals: 2
            });
        }

        // If the value is very small (< 0.1), use subscript if it has many leading zeros
        if (value > 0 && value < 0.1) {
            return formatPriceWithSubscript(value, {
                symbol: symbol,
                minDecimalsForSubscript: 4, // Start subscripting at 4 leading zeros (e.g. 0.00001)
                maxDisplayDecimals: 4
            });
        }

        // Default standard formatting
        const locale = language === 'en' ? 'en-US' : language;
        try {
            const formattedNumber = new Intl.NumberFormat(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: (value < 10) ? 6 : 2, // More decimals for small non-subscripted values
            }).format(value);

            return `${symbol}${formattedNumber}`;
        } catch (e) {
            return `${symbol}${value.toFixed(2)}`;
        }
    }

    /**
     * Localizes a date string/number based on user preference
     */
    formatDate(date: Date | string | number): string {
        const { dateFormat } = useLocaleStore.getState();
        const d = new Date(date);

        if (isNaN(d.getTime())) return '...';

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        switch (dateFormat) {
            case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
            case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
            case 'MM/DD/YYYY':
            default: return `${month}/${day}/${year}`;
        }
    }

    /**
     * Reactive conversion and formatting
     */
    convertAndFormat(usdAmount: number | string | undefined): string {
        if (usdAmount === undefined) return '...';
        const numAmount = typeof usdAmount === 'string' ? parseFloat(usdAmount) : usdAmount;
        if (isNaN(numAmount)) return '0.00';

        const { currency } = useLocaleStore.getState();
        const converted = this.convert(numAmount, currency);
        return this.format(converted, currency);
    }
}

export const currencyService = new CurrencyService();
