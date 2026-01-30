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
        prefix?: string;
        minDecimalsForSubscript?: number;
        maxDisplayDecimals?: number;
    } = {}
): string {
    const {
        prefix = '',
        minDecimalsForSubscript = 6,
        maxDisplayDecimals = 4,
    } = options;

    let numPrice: number;

    if (typeof price === 'string' && (price.includes('e') || price.includes('E'))) {
        numPrice = parseFloat(price);
    } else {
        numPrice = typeof price === 'string' ? parseFloat(price) : price;
    }

    if (isNaN(numPrice) || numPrice <= 0) {
        return `${prefix}0.00`;
    }

    // If price is >= 0.000001, use normal formatting
    if (numPrice >= 0.000001) {
        if (numPrice < 0.01) {
            return `${prefix}${numPrice.toFixed(6)}`;
        } else if (numPrice < 1) {
            return `${prefix}${numPrice.toFixed(4)}`;
        } else if (numPrice < 1000) {
            return `${prefix}${numPrice.toFixed(2)}`;
        } else {
            return `${prefix}${numPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
        }
    }

    // For very small prices, use subscript notation
    const priceStr = numPrice.toFixed(20);
    const [integerPart, decimalPart] = priceStr.split('.');

    if (!decimalPart) {
        return `${prefix}${integerPart}`;
    }

    let firstNonZeroIndex = -1;
    for (let i = 0; i < decimalPart.length; i++) {
        if (decimalPart[i] !== '0') {
            firstNonZeroIndex = i;
            break;
        }
    }

    if (firstNonZeroIndex === -1) {
        return `${prefix}0.00`;
    }

    const leadingZeros = firstNonZeroIndex;

    if (leadingZeros < minDecimalsForSubscript) {
        return `${prefix}${numPrice.toFixed(leadingZeros + maxDisplayDecimals + 1)}`;
    }

    const significantDigits = decimalPart.substring(firstNonZeroIndex);
    const displayDigits = significantDigits.substring(0, maxDisplayDecimals);

    const remainingZeros = leadingZeros - 1;
    const subscript = digitsToSubscript(remainingZeros.toString());

    return `${prefix}0.0${subscript}${displayDigits}`;
}

/**
 * Format USD price with subscript notation if needed
 */
export function formatUSDPrice(price: number | string): string {
    return formatPriceWithSubscript(price, {
        prefix: '$',
        minDecimalsForSubscript: 6,
        maxDisplayDecimals: 4,
    });
}

/**
 * Formats a number with K, M, B, T suffixes
 */
export function formatNumber(value: number | undefined, decimals: number = 2): string {
    if (value === undefined || value === null || isNaN(value)) {
        return '0';
    }

    if (value === 0) {
        return '0';
    }

    const absValue = Math.abs(value);

    if (absValue >= 1e12) {
        return `${(value / 1e12).toFixed(decimals)}T`;
    } else if (absValue >= 1e9) {
        return `${(value / 1e9).toFixed(decimals)}B`;
    } else if (absValue >= 1e6) {
        return `${(value / 1e6).toFixed(decimals)}M`;
    } else if (absValue >= 1e3) {
        return `${(value / 1e3).toFixed(decimals)}K`;
    } else {
        return value.toFixed(decimals);
    }
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
