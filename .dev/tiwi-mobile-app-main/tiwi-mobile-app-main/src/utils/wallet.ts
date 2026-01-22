/**
 * Wallet utility functions
 * Handles wallet address truncation and formatting
 */

// Main wallet address used throughout the app
export const WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

/**
 * Truncates wallet address to show first 6 and last 4 characters
 * Example: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e -> 0x742...f44e
 */
export const truncateAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Validates if a string is a valid Ethereum address format
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};


