// Wallet Utilities
// Helper functions for wallet operations

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
export const MORALIS_NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
/**
 * Native SOL - Solana's System Program, the address the routers and balance
 * pipeline both carry a lamport balance under. NOT `So111…112`: that mint is
 * WRAPPED SOL, a distinct SPL holding.
 */
export const SOLANA_NATIVE_ADDRESS = '11111111111111111111111111111111';

/**
 * Truncates a wallet address for display
 * @param address Full wallet address
 * @param startChars Number of characters to show at start (default: 6)
 * @param endChars Number of characters to show at end (default: 4)
 * @returns Truncated address (e.g., "0x742d...0bEb")
 */
export const truncateAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Validates if a string is a valid Ethereum address
 * @param address Address to validate
 * @returns Boolean indicating if address is valid
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};
/**
 * Checks if an address represents a native token (ETH, BNB, etc)
 * @param address Token address
 * @returns Boolean
 */
export const isNativeToken = (address: string | undefined | null): boolean => {
  if (!address) return true;
  const lower = address.toLowerCase();
  return (
    lower === NATIVE_TOKEN_ADDRESS ||
    lower === MORALIS_NATIVE_ADDRESS ||
    lower === SOLANA_NATIVE_ADDRESS ||
    lower === 'native'
  );
};

/**
 * Do two rows describe the same holding? Sources spell a native coin several
 * ways ('native', 0x0…0, Solana's System Program), so comparing addresses
 * literally can strand a wallet balance from the list row it belongs to.
 */
export const isSameTokenAddress = (a?: string | null, b?: string | null): boolean => {
  if (isNativeToken(a) || isNativeToken(b)) return isNativeToken(a) && isNativeToken(b);
  return (a || '').toLowerCase() === (b || '').toLowerCase();
};
