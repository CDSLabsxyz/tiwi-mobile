/**
 * Address Validation Utilities
 * Validates blockchain addresses for different chains
 */

import type { ChainId } from "@/components/sections/Swap/ChainSelectSheet";

export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Validates Ethereum/EVM address (0x followed by 40 hex characters)
 */
const validateEVMAddress = (address: string): ValidationResult => {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, error: "Address is required" };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { isValid: false, error: "Invalid address format" };
  }
  return { isValid: true };
};

/**
 * Validates Solana address (Base58, 32-44 characters)
 */
const validateSolanaAddress = (address: string): ValidationResult => {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, error: "Address is required" };
  }
  // Solana addresses are Base58 encoded, typically 32-44 characters
  // Base58: 1-9, A-H, J-N, P-Z, a-k, m-z (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!base58Regex.test(trimmed)) {
    return { isValid: false, error: "Invalid Solana address format" };
  }
  return { isValid: true };
};

/**
 * Validates SUI address (0x followed by 64 hex characters)
 */
const validateSuiAddress = (address: string): ValidationResult => {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, error: "Address is required" };
  }
  // SUI addresses are 0x followed by 64 hex characters
  if (!/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return { isValid: false, error: "Invalid SUI address format" };
  }
  return { isValid: true };
};

/**
 * Validates Cosmos address (bech32 format, typically starts with cosmos, osmo, etc.)
 */
const validateCosmosAddress = (address: string): ValidationResult => {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, error: "Address is required" };
  }
  // Cosmos addresses use bech32 encoding
  // Format: prefix + separator (1) + data (32 bytes encoded) + checksum (6 chars)
  // Common prefixes: cosmos, osmo, juno, etc.
  const bech32Regex = /^[a-z]{1,83}1[a-z0-9]{38,58}$/;
  if (!bech32Regex.test(trimmed.toLowerCase())) {
    return { isValid: false, error: "Invalid Cosmos address format" };
  }
  return { isValid: true };
};

/**
 * Validates address based on chain type
 */
export const validateAddress = (address: string, chainId: string | null | undefined): ValidationResult => {
  if (!chainId) {
    // If no chain selected, allow any format but still check basic format
    const trimmed = address.trim();
    if (!trimmed) {
      return { isValid: false, error: "Address is required" };
    }
    // Basic validation - at least looks like an address
    if (trimmed.length < 10) {
      return { isValid: false, error: "Address is too short" };
    }
    return { isValid: true };
  }

  // Map chain IDs to validation functions
  const chainValidationMap: Record<string, (addr: string) => ValidationResult> = {
    // EVM chains (Ethereum, Polygon, Avalanche, etc.)
    ethereum: validateEVMAddress,
    verdant: validateEVMAddress, // Assuming Verdant is EVM-compatible
    cortex: validateEVMAddress, // Assuming Cortex is EVM-compatible
    
    // Solana
    aegis: validateSolanaAddress, // Aegis uses Solana icon, so likely Solana-based
    
    // SUI - if we have a SUI chain
    // sui: validateSuiAddress,
    
    // Cosmos - if we have a Cosmos chain
    // cosmos: validateCosmosAddress,
    apex: validateCosmosAddress, // Apex might be Cosmos-based (or could be EVM, adjust as needed)
  };

  const validator = chainValidationMap[chainId];
  if (validator) {
    return validator(address);
  }

  // Default to EVM validation for unknown chains
  return validateEVMAddress(address);
};

/**
 * Validates multiple addresses (for multi-send)
 */
export const validateAddresses = (
  addresses: string[],
  chainId: string | null | undefined
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  let allValid = true;

  addresses.forEach((address, index) => {
    const result = validateAddress(address, chainId);
    if (!result.isValid) {
      allValid = false;
      errors.push(`Address ${index + 1}: ${result.error || "Invalid address"}`);
    }
  });

  return { isValid: allValid, errors };
};

/**
 * Validates amount (only numbers and decimals)
 */
export const validateAmount = (amount: string): ValidationResult => {
  const trimmed = amount.trim();
  if (!trimmed) {
    return { isValid: false, error: "Amount is required" };
  }
  
  // Only allow numbers and one decimal point
  if (!/^\d*\.?\d*$/.test(trimmed)) {
    return { isValid: false, error: "Only numbers and decimals allowed" };
  }
  
  // Check if it's a valid number
  const numValue = parseFloat(trimmed);
  if (isNaN(numValue)) {
    return { isValid: false, error: "Invalid number" };
  }
  
  if (numValue <= 0) {
    return { isValid: false, error: "Amount must be greater than 0" };
  }
  
  return { isValid: true };
};

