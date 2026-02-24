/**
 * RPC Configuration for all supported chains.
 * 
 * Uses reliable RPC URLs with proper timeouts.
 * Can be overridden via environment variables.
 */

export const RPC_CONFIG: Record<number, string> = {
    // Ethereum Mainnet (1)
    1: 'https://eth-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',

    // Arbitrum One (42161)
    42161: 'https://arb-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',

    // Optimism (10)
    10: 'https://opt-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',

    // Polygon (137)
    137: 'https://polygon-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',

    // Base (8453)
    8453: 'https://base-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl',

    // BSC / Binance Smart Chain (56)
    56: 'https://bnb-mainnet.g.alchemy.com/v2/WLJoFMJfcDSAUbsnhlyCl', // More reliable than public thirdweb
};

/**
 * Get RPC URL for a specific chain ID.
 * 
 * @param chainId - Chain ID
 * @returns RPC URL or undefined if not configured
 */
export function getRpcUrl(chainId: number): string | undefined {
    return RPC_CONFIG[chainId];
}

/**
 * HTTP transport options for RPC calls.
 */
export const RPC_TRANSPORT_OPTIONS = {
    timeout: 15000,
    retryCount: 2,
} as const;
