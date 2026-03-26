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

    let numPrice: number = typeof price === 'string' ? parseFloat(price) : price;

    if (isNaN(numPrice) || numPrice === 0) {
        return `${symbol}0.00`;
    }

    // Handle Negative
    const isNegative = numPrice < 0;
    numPrice = Math.abs(numPrice);

    // For "normal" prices (>= 0.0001), use high-precision standard rounding
    if (numPrice >= 0.0001) {
        let decimals = 2;
        if (numPrice < 0.1) decimals = 6;
        else if (numPrice < 1) decimals = 4;

        const formatted = numPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: decimals,
        });
        return `${isNegative ? '-' : ''}${symbol}${formatted}`;
    }

    // For very small prices, use exponential notation to find leading zeros accurately
    const exponential = numPrice.toExponential();
    const [coefficient, exponentStr] = exponential.split('e');
    const exponent = Math.abs(parseInt(exponentStr, 10)); // e.g. 10 for 2.5e-10

    // leadingZeros is (exponent - 1) because 1.23e-10 is 0.000000000123 (9 zeros)
    const leadingZeros = exponent - 1;

    // If we have fewer leading zeros than the threshold, just show them as standard decimal
    if (leadingZeros < minDecimalsForSubscript) {
        const formatted = numPrice.toFixed(leadingZeros + maxDisplayDecimals);
        return `${isNegative ? '-' : ''}${symbol}${formatted}`;
    }

    // Subscript notation for many leading zeros (Web style: 0.0(9)7322)
    // Extract significant digits from the coefficient (remove dot)
    const significantDigits = (coefficient.replace('.', '') + '0000').substring(0, maxDisplayDecimals);

    return `${isNegative ? '-' : ''}${symbol}0.0(${leadingZeros})${significantDigits}`;
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

/**
 * SMART FORMATTING CORE
 * Modular utilities to handle subscript, standard, and compact notation automatically.
 */

/**
 * Smart Price Formatter
 * - < $0.0001: Subscript (Sub-zero) notation
 * - $0.0001 to $1000: Standard decimal notation (4-6 decimals)
 * - > $1000: Compact notation ($1.2K, $98.5K)
 */
export function formatSmartPrice(price: number | string, symbol: string = '$'): string {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num) || num === 0) return `${symbol}0.00`;

    // Large Values: Compact
    if (num >= 1000) {
        return formatCompactNumber(num, { symbol, decimals: 2 });
    }

    // Tiny Values: Subscript
    if (num < 0.0001) {
        return formatPriceWithSubscript(num, { symbol });
    }

    // Standard Range: High Precision
    return symbol + num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
}

/**
 * Smart USD Metrics Formatter (Market Cap, FDV, Liquidity, Volume)
 * - Always uses Compact notation for readability.
 * - Handles tiny values (e.g. liquidity in new pools) with standard decimals.
 */
export function formatSmartUSD(value: number | string, symbol: string = '$'): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return `${symbol}0.00`;

    if (num >= 1000) {
        return formatCompactNumber(num, { symbol, decimals: 2 });
    }

    if (num < 0.01 && num > 0) {
        // For tiny metrics, use subscript to keep them readable
        return formatPriceWithSubscript(num, { symbol });
    }

    return symbol + num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Convert amount to smallest unit (wei, etc.)
 * Ported from reference transfer.ts to ensure robust precision management
 */
export function toSmallestUnit(amount: string, decimals: number): string {
    const amountStr = amount.toString().trim();

    if (amountStr.includes("e") || amountStr.includes("E")) {
        const num = parseFloat(amountStr);
        const parts = num.toFixed(decimals).split(".");
        const integerPart = parts[0];
        const decimalPart = parts[1] || "";
        const paddedDecimal = decimalPart.padEnd(decimals, "0").substring(0, decimals);
        return integerPart + paddedDecimal;
    }

    const decimalIndex = amountStr.indexOf(".");
    if (decimalIndex === -1) {
        const amountBigInt = BigInt(amountStr);
        const safeDecimals = Math.max(0, decimals || 0);
        const decimalsMultiplier = BigInt(10) ** BigInt(safeDecimals);
        return (amountBigInt * decimalsMultiplier).toString();
    }

    const integerPart = amountStr.substring(0, decimalIndex) || "0";
    let decimalPart = amountStr.substring(decimalIndex + 1);

    if (decimalPart.length > decimals) {
        decimalPart = decimalPart.substring(0, decimals);
    } else {
        decimalPart = decimalPart.padEnd(decimals, "0");
    }

    return integerPart + decimalPart;
}
