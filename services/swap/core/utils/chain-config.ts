/**
 * Centralized Chain Configuration
 * Single source of truth for viem chain configurations
 * 
 * This utility provides chain configuration for all backend services,
 * ensuring consistency across PancakeSwap, Uniswap, and other router adapters.
 */

import { type Chain } from 'viem';
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'viem/chains';

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
  56: bsc,
};

/**
 * Get chain configuration for a chain ID
 * @param chainId - The chain ID to get configuration for
 * @returns The viem Chain configuration or null if not supported
 */
export function getChainConfig(chainId: number): Chain | null {
  return CHAIN_MAP[chainId] || null;
}

/**
 * Check if a chain is supported
 * @param chainId - The chain ID to check
 * @returns True if the chain is supported, false otherwise
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_MAP;
}

/**
 * Get all supported chain IDs
 * @returns Array of supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(CHAIN_MAP).map(id => parseInt(id, 10));
}

