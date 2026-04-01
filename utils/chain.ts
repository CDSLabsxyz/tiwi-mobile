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

// Map native token symbols to their primary chain
const SYMBOL_TO_CHAIN: Record<string, string> = {
    SOL: 'Solana',
    WSOL: 'Solana',
    TRX: 'TRON',
    TON: 'TON',
    ATOM: 'Cosmos',
    OSMO: 'Osmosis',
    MATIC: 'Polygon',
    POL: 'Polygon',
    BNB: 'BNB Chain',
    AVAX: 'Avalanche',
    ETH: 'Ethereum',
    ARB: 'Arbitrum',
    OP: 'Optimism',
};

/**
 * Get display name for a chain ID, with optional symbol override
 */
export function getChainName(chainId: number | string | undefined, symbol?: string): string {
    // Symbol-based override for native tokens (handles CEX data without chainId)
    if (symbol) {
        const sym = symbol.toUpperCase();
        if (SYMBOL_TO_CHAIN[sym]) return SYMBOL_TO_CHAIN[sym];
    }

    if (!chainId) return 'Unknown Chain';
    const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    return CHAIN_NAMES[id] || `Chain ${id}`;
}
