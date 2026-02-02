/**
 * Formatting Utilities
 * Ported from Tiwi Web App for consistency
 */

// Unicode subscript characters for digits 0-9
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/**
 * Convert a number to subscript notation
 */
function toSubscript(num: number): string {
    if (num >= 0 && num <= 9) {
        return SUBSCRIPT_DIGITS[num];
    }
    return num.toString();
}

/**
 * Convert a string of digits to subscript
 */
function digitsToSubscript(digits: string): string {
    return digits.split('').map(d => toSubscript(parseInt(d, 10))).join('');
}

/**
 * Format a very small price with subscript notation (DexScreener style)
 */
export function formatPriceWithSubscript(
    price: number | string,
    options: {
        symbol?: string;
        minDecimalsForSubscript?: number;
        maxDisplayDecimals?: number;
    } = {}
): string {
    const {
        symbol = '',
        minDecimalsForSubscript = 5,
        maxDisplayDecimals = 4,
    } = options;

    let numPrice: number;

    if (typeof price === 'string' && (price.includes('e') || price.includes('E'))) {
        numPrice = parseFloat(price);
    } else {
        numPrice = typeof price === 'string' ? parseFloat(price) : price;
    }

    if (isNaN(numPrice) || numPrice <= 0) {
        return `${symbol}0.00`;
    }

    // For "normal" prices, use standard rounding
    if (numPrice >= 0.0001) {
        if (numPrice < 1) {
            return `${symbol}${numPrice.toLocaleString('en-US', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 6,
            })}`;
        } else if (numPrice < 1000) {
            return `${symbol}${numPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
            })}`;
        } else {
            return `${symbol}${numPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
        }
    }

    // For very small prices, use subscript notation
    // Use toFixed(20) to avoid scientific notation
    const priceStr = numPrice.toFixed(20);
    const [, decimalPart] = priceStr.split('.');

    if (!decimalPart) {
        return `${symbol}0.00`;
    }

    let firstNonZeroIndex = -1;
    for (let i = 0; i < decimalPart.length; i++) {
        if (decimalPart[i] !== '0') {
            firstNonZeroIndex = i;
            break;
        }
    }

    if (firstNonZeroIndex === -1) {
        return `${symbol}0.00`;
    }

    const leadingZeros = firstNonZeroIndex;

    // If we have fewer leading zeros than the threshold, just show them
    if (leadingZeros < minDecimalsForSubscript) {
        return `${symbol}${numPrice.toFixed(leadingZeros + maxDisplayDecimals + 1)}`;
    }

    // Subscript notation for many leading zeros
    const significantDigits = decimalPart.substring(firstNonZeroIndex);
    const displayDigits = significantDigits.substring(0, maxDisplayDecimals);

    // Number of zeros to show in subscript is (leadingZeros)
    // DexScreener/Binance style: 0.0{number_of_zeros}significant_digits
    const subscript = digitsToSubscript(leadingZeros.toString());

    return `${symbol}0.0${subscript}${displayDigits}`;
}

/**
 * Format USD price with subscript notation if needed
 */
export function formatUSDPrice(price: number | string): string {
    return formatPriceWithSubscript(price, {
        symbol: '$',
        minDecimalsForSubscript: 5,
        maxDisplayDecimals: 4,
    });
}

export function formatCompactNumber(value: number | undefined, options: { decimals?: number, symbol?: string } = {}): string {
    const { decimals = 2, symbol = '' } = options;
    if (value === undefined || value === null || isNaN(value)) {
        return `${symbol}0`;
    }

    if (value === 0) {
        return `${symbol}0`;
    }

    const absValue = Math.abs(value);
    let result = '';

    const formatPart = (val: number, suffix: string) => {
        const num = val.toFixed(decimals);
        // Remove trailing zeros if they are all zeros after decimal
        const trimmed = num.replace(/\.0+$/, '').replace(/(\.[0-9]*[1-9])0+$/, '$1');
        return `${trimmed}${suffix}`;
    };

    if (absValue >= 1e12) {
        result = formatPart(value / 1e12, 'T');
    } else if (absValue >= 1e9) {
        result = formatPart(value / 1e9, 'B');
    } else if (absValue >= 1e6) {
        result = formatPart(value / 1e6, 'M');
    } else if (absValue >= 1e3) {
        result = formatPart(value / 1e3, 'K');
    } else {
        result = value.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    }

    return `${symbol}${result}`;
}

/**
 * Legacy formatNumber (for backwards compatibility if needed, but updated)
 */
export function formatNumber(value: number | undefined, decimals: number = 2): string {
    return formatCompactNumber(value, { decimals });
}

/**
 * Formats a currency value with K, M, B, T suffixes and a prefix
 */
export function formatCurrencyWithSuffix(value: number | undefined, prefix: string = '$', decimals: number = 2): string {
    if (value === undefined || value === null || isNaN(value)) {
        return `${prefix}0`;
    }
    return `${prefix}${formatNumber(value, decimals)}`;
}

/**
 * Formats percentage change
 */
export function formatPercentageChange(value: number | undefined): {
    formatted: string;
    isPositive: boolean;
} {
    if (value === undefined || value === null || isNaN(value)) {
        return { formatted: '0.00%', isPositive: false };
    }

    const isPositive = value >= 0;
    const formatted = `${isPositive ? '+' : ''}${value.toFixed(2)}%`;

    return { formatted, isPositive };
}

/**
 * Generates a consistent colorful hex code from a string (e.g., token symbol)
 */
export function getColorFromSeed(seed: string): string {
    const palette = [
        '#FF5C5C', // Red
        '#3FEA9B', // Green
        '#4EA1FF', // Blue
        '#FFBD5C', // Orange
        '#A15CFF', // Purple
        '#5CFFE3', // Cyan
        '#FF5C9D', // Pink
        '#D0FB43', // Lime
        '#FF8C5C', // Coral
        '#5C74FF', // Indigo
    ];
    if (!seed) return palette[0];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
}

/**
 * Formats a token amount with Rabby-style suffixes (B, M, K)
 * or full amount up to 4 decimals for smaller values.
 */
export function formatTokenQuantity(amount: string | number): string {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(val) || val === 0) return '0';

    const absVal = Math.abs(val);

    // Scaling to Billions, Millions, or Thousands with exactly 4 decimal places rounded
    if (absVal >= 1e9) {
        return (val / 1e9).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        }) + ' B';
    } else if (absVal >= 1e6) {
        return (val / 1e6).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        }) + ' M';
    } else if (absVal >= 100000) { // Suffix K for values over 100k
        return (val / 1e3).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        }) + ' K';
    }

    // Default to full amount with commas and max 4 decimals
    return val.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
        useGrouping: true,
    });
}

/**
 * Formats a token amount without compact notation (no M/K)
 * Enforces a 4-decimal ceiling for display as per user requirement.
 */
export function formatFullAmount(amount: string | number): string {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(val) || val === 0) return '0';

    // ceiling/round to 4 decimal places for display with thousand separators
    return val.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
        useGrouping: true,
    });
}

/**
 * Smart formatting for token amounts (Uniswap style)
 * - Large numbers: Use compact notation (B, M, K) with 4 decimal rounding
 * - Small numbers: Show full precision up to 4 decimal places
 */
export function formatTokenAmount(amount: string | number): string {
    // Calling formatTokenQuantity which implements the B/M/K suffix logic and 4-decimal rounding
    return formatTokenQuantity(amount);
}

/**
 * Format fiat value with user's preferred locale and currency
 */
export function formatFiatValue(
    amount: string | number,
    locale: string = 'en-US',
    currency: string = 'USD'
): string {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(val)) return formatCompactNumber(0, { symbol: '$' }); // Fallback

    try {
        return new Intl.NumberFormat(locale === 'US' ? 'en-US' : locale, { // Handle 'US' region code mapping
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val);
    } catch (e) {
        // Fallback if locale/currency code is invalid
        return `$${val.toFixed(2)}`;
    }
}
