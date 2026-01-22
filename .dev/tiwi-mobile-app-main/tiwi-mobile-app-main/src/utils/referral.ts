/**
 * Referral utility functions
 * Handles referral code generation, link creation, and validation
 */

import { WALLET_ADDRESS } from './wallet';

// Base referral URL - in production, this would be your app's deep link or web URL
const REFERRAL_BASE_URL = 'https://www.tiwiprotocol.com/referral';

/**
 * Generates a unique referral code for a user
 * In production, this would be fetched from the backend or generated based on wallet address
 */
export const generateReferralCode = (walletAddress: string = WALLET_ADDRESS): string => {
  // For now, generate a code based on wallet address
  // In production, this would be stored in the backend
  const hash = walletAddress.slice(2, 10).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TIWI${hash}${random}`;
};

/**
 * Gets or generates referral code for current user
 * In production, this would fetch from backend/storage
 */
export const getReferralCode = (): string => {
  // Check if code exists in storage, otherwise generate
  // For now, always generate (in production, use AsyncStorage or backend)
  return generateReferralCode();
};

/**
 * Creates a referral link with the referral code
 */
export const createReferralLink = (code?: string): string => {
  const referralCode = code || getReferralCode();
  return `${REFERRAL_BASE_URL}?ref=${referralCode}`;
};

/**
 * Validates a referral code format
 */
export const isValidReferralCode = (code: string): boolean => {
  // Referral codes are alphanumeric, typically 8-12 characters
  return /^[A-Z0-9]{8,12}$/.test(code);
};

/**
 * Extracts referral code from a referral link
 */
export const extractReferralCodeFromLink = (link: string): string | null => {
  const match = link.match(/[?&]ref=([A-Z0-9]+)/i);
  return match ? match[1].toUpperCase() : null;
};





