/**
 * Chain Utilities
 */

export const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum',
    56: 'BNB Chain',
    137: 'Polygon',
    42161: 'Arbitrum',
    10: 'Optimism',
    43114: 'Avalanche',
    8453: 'Base',
    7565164: 'Solana',
    1100: 'TON',
    728126428: 'TRON'
};

/**
 * Get display name for a chain ID
 */
export function getChainName(chainId: number | string | undefined): string {
    if (!chainId) return 'Unknown Chain';
    const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    return CHAIN_NAMES[id] || `Chain ${id}`;
}
