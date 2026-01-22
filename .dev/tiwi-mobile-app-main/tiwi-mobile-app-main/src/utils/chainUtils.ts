/**
 * Chain Utilities
 * Helper functions for working with chains
 * Production-ready utilities for chain management
 */

import type { ChainId, ChainOption } from "@/components/sections/Swap/ChainSelectSheet";

const EthereumIcon = require("@/assets/home/chains/ethereum.svg");
const ApexIcon = require("@/assets/home/chains/near.svg");
const VerdantIcon = require("@/assets/home/chains/polygon.svg");
const AegisIcon = require("@/assets/home/chains/solana.svg");
const CortexIcon = require("@/assets/home/chains/avalanche.svg");

/**
 * Chain configuration mapping
 * Production-ready structure for chain data
 */
const CHAIN_CONFIG: Record<ChainId, ChainOption> = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    icon: EthereumIcon,
  },
  apex: {
    id: "apex",
    name: "Apex Network",
    icon: ApexIcon,
  },
  verdant: {
    id: "verdant",
    name: "Verdant Protocol",
    icon: VerdantIcon,
  },
  aegis: {
    id: "aegis",
    name: "Aegis Core",
    icon: AegisIcon,
  },
  cortex: {
    id: "cortex",
    name: "Cortex Chain",
    icon: CortexIcon,
  },
};

/**
 * Gets chain option by chainId
 * Production-ready function to retrieve chain configuration
 */
export const getChainOption = (chainId: ChainId): ChainOption => {
  return CHAIN_CONFIG[chainId];
};

/**
 * Gets chain option by chainId with fallback
 * Returns Ethereum as default if chainId is invalid
 */
export const getChainOptionWithFallback = (chainId: ChainId | null | undefined): ChainOption => {
  if (!chainId || !CHAIN_CONFIG[chainId]) {
    return CHAIN_CONFIG.ethereum;
  }
  return CHAIN_CONFIG[chainId];
};

/**
 * Validates if a chainId is valid
 */
export const isValidChainId = (chainId: string): chainId is ChainId => {
  return chainId in CHAIN_CONFIG;
};


