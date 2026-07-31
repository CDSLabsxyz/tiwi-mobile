/**
 * Amount Conversion Utilities
 * 
 * Utilities for converting between human-readable amounts and smallest units.
 */

/**
 * Convert human-readable amount to smallest unit (e.g., "100.5" -> "100500000000000000000")
 * 
 * @param amount - Human-readable amount (e.g., "100.5")
 * @param decimals - Token decimals (e.g., 18)
 * @returns Amount in smallest unit as string
 * 
 * @example
 * toSmallestUnit("100.5", 18) // "100500000000000000000"
 * toSmallestUnit("1", 6) // "1000000"
 */
export function toSmallestUnit(amount: string, decimals: number): string {
  if (!amount || amount.trim() === '') {
    return '0';
  }

  const amountStr = amount.toString().trim();
  
  // Handle scientific notation
  if (amountStr.includes('e') || amountStr.includes('E')) {
    const num = parseFloat(amountStr);
    const parts = num.toFixed(decimals).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';
    const paddedDecimal = decimalPart.padEnd(decimals, '0').substring(0, decimals);
    return integerPart + paddedDecimal;
  }
  
  // Handle regular decimal number
  const decimalIndex = amountStr.indexOf('.');
  
  if (decimalIndex === -1) {
    // No decimal point - just multiply
    const amountBigInt = BigInt(amountStr);
    const decimalsMultiplier = BigInt(10 ** decimals);
    return (amountBigInt * decimalsMultiplier).toString();
  }
  
  // Has decimal point - handle precision
  const integerPart = amountStr.substring(0, decimalIndex) || '0';
  let decimalPart = amountStr.substring(decimalIndex + 1);
  
  // Pad or truncate decimal part to match token decimals
  if (decimalPart.length > decimals) {
    // Need to round, not just truncate, to preserve precision
    // Check if we need to round up (next digit >= 5)
    const nextDigit = parseInt(decimalPart[decimals] || '0', 10);
    const truncatedDecimal = decimalPart.substring(0, decimals);
    
    if (nextDigit >= 5) {
      // Round up: add 1 to the truncated decimal part
      const decimalBigInt = BigInt(truncatedDecimal || '0');
      const roundedDecimal = decimalBigInt + BigInt(1);
      const roundedDecimalStr = roundedDecimal.toString().padStart(decimals, '0');
      
      // Check for overflow (e.g., 999 + 1 = 1000)
      if (roundedDecimalStr.length > decimals) {
        // Overflow: increment integer part and reset decimal to zeros
        const integerBigInt = BigInt(integerPart) + BigInt(1);
        return (integerBigInt * BigInt(10 ** decimals)).toString();
      }
      decimalPart = roundedDecimalStr;
    } else {
      // Round down: just truncate
      decimalPart = truncatedDecimal;
    }
  } else {
    // Pad with zeros to match decimals
    decimalPart = decimalPart.padEnd(decimals, '0');
  }
  
  // Combine integer and decimal parts using BigInt arithmetic to avoid precision loss
  // This ensures we preserve full precision even for very large numbers
  const integerBigInt = BigInt(integerPart);
  const decimalBigInt = BigInt(decimalPart);
  const decimalsMultiplier = BigInt(10 ** decimals);
  const result = (integerBigInt * decimalsMultiplier + decimalBigInt).toString();
  
  return result;
}

/**
 * Convert smallest unit to human-readable amount (e.g., "100500000000000000000" -> "100.5")
 * 
 * @param amount - Amount in smallest unit as string
 * @param decimals - Token decimals (e.g., 18)
 * @returns Human-readable amount as string
 * 
 * @example
 * fromSmallestUnit("100500000000000000000", 18) // "100.5"
 * fromSmallestUnit("1000000", 6) // "1"
 */
export function fromSmallestUnit(amount: string, decimals: number): string {
  if (!amount || amount === '0') {
    return '0';
  }

  const amountStr = amount.toString().trim();
  const amountBigInt = BigInt(amountStr);
  const decimalsMultiplier = BigInt(10 ** decimals);
  
  const integerPart = amountBigInt / decimalsMultiplier;
  const fractionalPart = amountBigInt % decimalsMultiplier;
  
  if (fractionalPart === BigInt(0)) {
    return integerPart.toString();
  }
  
  // Format fractional part with proper padding
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return integerPart.toString();
  }
  
  return `${integerPart}.${trimmedFractional}`;
}

/**
 * Format amount for display (with appropriate decimal places)
 * 
 * @param amount - Human-readable amount
 * @param maxDecimals - Maximum decimal places to show
 * @returns Formatted amount string
 * 
 * @example
 * formatAmount("100.123456789", 6) // "100.123457"
 * formatAmount("0.000001", 6) // "0.000001"
 */
export function formatAmount(amount: string, maxDecimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return '0';
  }
  
  if (num === 0) {
    return '0';
  }
  
  // For very small amounts, show more decimals
  if (num < 0.000001) {
    return num.toFixed(12);
  }
  
  // For regular amounts, use maxDecimals
  return num.toFixed(maxDecimals);
}

