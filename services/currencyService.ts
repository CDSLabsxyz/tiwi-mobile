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

// Currency symbol lookup — used when the locale store no longer owns a
// currencies array. Covers the common ISO 4217 codes our price feeds return.
const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', HKD: 'HK$', SGD: 'S$',
    AUD: 'A$', CAD: 'CA$', CHF: 'CHF', INR: '₹', NGN: '₦', GHS: 'GH₵',
    KES: 'KSh', ZAR: 'R', AED: 'AED', BRL: 'R$', RUB: '₽', TRY: '₺',
    MXN: 'Mex$', ILS: '₪', PHP: '₱', VND: '₫', THB: '฿', IDR: 'Rp',
    PKR: '₨', EGP: 'E£', GEL: '₾', SAR: 'SAR', KRW: '₩', TWD: 'NT$',
    PLN: 'zł', SEK: 'kr', NOK: 'kr', DKK: 'kr', CZK: 'Kč', HUF: 'Ft',
    RON: 'lei', UAH: '₴', BGN: 'лв', MYR: 'RM', BDT: '৳', LKR: 'Rs',
    KZT: '₸', AZN: '₼', AMD: '֏', BYN: 'Br',
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
        const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;

        // 1. Precise Zero Check
        if (value === 0) return `${symbol}0.00`;

        // 2. Large Values (>= 10,000) -> Compact (K, M, B, T)
        if (value >= 10000) {
            return formatCompactNumber(value, {
                symbol: symbol,
                decimals: 2
            });
        }

        // 3. Tiny Micro-Prices or Small values (< 0.1)
        // Use subscript logic which handles everything down to 1e-100 accurately
        if (value < 0.1) {
            return formatPriceWithSubscript(value, {
                symbol: symbol,
                minDecimalsForSubscript: 5,
                maxDisplayDecimals: 4
            });
        }

        // 4. Stablecoins or Mid-range ($0.1 to $10)
        // We want at least 4 decimals for stablecoins ($0.9997)
        if (value < 10) {
            const formattedNumber = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
            }).format(value);
            return `${symbol}${formattedNumber}`;
        }

        // 5. Standard formatting ($10 to $10,000)
        try {
            const formattedNumber = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(value);

            return `${symbol}${formattedNumber}`;
        } catch (e) {
            // Smart Fallback: If it's very small but fails, use toPrecision
            if (value < 0.01) return `${symbol}${value.toPrecision(4)}`;
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
            case 'DD/MM/YY': return `${day}/${month}/${year}`;
            case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
            case 'MM/DD/YY':
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
