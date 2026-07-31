/**
 * Chain Helper Utilities
 *
 * Utilities for working with different blockchain networks.
 */

import { getCanonicalChain } from '@/services/swap/core/registry/chains';
import { isCosmosChainId } from '@/services/swap/core/utils/cosmos-chains';

// Fast-path allow-list for the most common EVM chains, so the hot path avoids a
// registry lookup. The canonical registry (below) is the actual source of truth
// and covers every EVM chain the app routes (HyperEVM 999, Linea, Scroll, ...).
const COMMON_EVM_CHAINS = new Set([
  1,     // Ethereum Mainnet
  5,     // Goerli
  137,   // Polygon
  42161, // Arbitrum
  10,    // Optimism
  8453,  // Base
  56,    // BSC
  43114, // Avalanche
  250,   // Fantom
  42220, // Celo
]);

/**
 * Check if a chain ID is an EVM chain.
 *
 * Sources the answer from the canonical registry rather than a hard-coded list,
 * so it stays in sync with routing/quoting. A static allow-list here previously
 * rejected HyperEVM (999) at the wallet-client step even though the quote layer
 * supported it — don't reintroduce a hard-coded list as the source of truth.
 */
export function isEVMChain(chainId: number): boolean {
  if (COMMON_EVM_CHAINS.has(chainId)) return true;
  try {
    return getCanonicalChain(chainId)?.type === 'EVM';
  } catch {
    return false;
  }
}

/**
 * Check if a chain ID is Solana
 */
export function isSolanaChain(chainId: number): boolean {
  // 1399811149 is Solana mainnet's genesis-derived id, which the mobile token
  // lists and several providers use alongside our canonical 7565164. Omitting
  // it made a SOL-sourced route fall through to the EVM signer path.
  return (
    chainId === 7565164 ||
    chainId === 1399811149 ||
    chainId === 501 ||
    chainId === 103
  );
}

/**
 * Check if a chain ID is TON
 */
export function isTONChain(chainId: number): boolean {
  return chainId === 1100;
}

/**
 * Check if a chain ID is TRON
 */
export function isTRONChain(chainId: number): boolean {
  return chainId === 728126428;
}

/**
 * Check if a chain ID is a Cosmos-family chain.
 *
 * Sourced from the shared Cosmos registry + the canonical registry, NOT a
 * hard-coded id. The old `chainId === 118` stub recognised only Cosmos Hub, so
 * every other Cosmos chain (Osmosis, dYdX, Secret, Neutron, …) was classified
 * non-Cosmos → the swap executor treated it as EVM and threw "Chain <id> is not
 * an EVM chain" (e.g. an SCRT→SHD swap on Secret 8000007). Covers all 14
 * cosmos-family chains: the 13 standard-secp256k1 chains via isCosmosChainId
 * (incl. Osmosis, typed 'Osmosis') plus Injective (8000001, eth_secp256k1, typed
 * 'Cosmos') via the registry. Mirrors isEVMChain — registry is the source of truth.
 */
export function isCosmosChain(chainId: number): boolean {
  if (isCosmosChainId(chainId)) return true;
  try {
    const type = getCanonicalChain(chainId)?.type;
    return type === 'Cosmos' || type === 'Osmosis';
  } catch {
    return false;
  }
}

/**
 * Get chain type from chain ID
 */
export function getChainType(chainId: number): 'evm' | 'solana' | 'ton' | 'tron' | 'cosmos' | 'unknown' {
  if (isEVMChain(chainId)) return 'evm';
  if (isSolanaChain(chainId)) return 'solana';
  if (isTONChain(chainId)) return 'ton';
  if (isTRONChain(chainId)) return 'tron';
  if (isCosmosChain(chainId)) return 'cosmos';
  return 'unknown';
}

/**
 * Check if a token is a native token for a given chain
 */
export function isNativeToken(tokenAddress: string, chainId: number): boolean {
  // EVM native tokens
  if (isEVMChain(chainId)) {
    return (
      tokenAddress === '0x0000000000000000000000000000000000000000' ||
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
  }

  // Solana native SOL
  if (isSolanaChain(chainId)) {
    return (
      tokenAddress === '11111111111111111111111111111111' ||
      tokenAddress === 'So11111111111111111111111111111111111111112'
    );
  }

  return false;
}

/**
 * Get native token address for a chain
 */
export function getNativeTokenAddress(chainId: number): string {
  if (isEVMChain(chainId)) {
    return '0x0000000000000000000000000000000000000000';
  }
  if (isSolanaChain(chainId)) {
    return 'So11111111111111111111111111111111111111112';
  }
  throw new Error(`Unknown chain type for chain ID: ${chainId}`);
}

