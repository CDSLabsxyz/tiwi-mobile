/**
 * Chain Utilities
 */

import { ALIAS_CHAIN_NAMES, KNOWN_CHAIN_NAMES } from '@/constants/knownChains';

/**
 * Every chain the app can surface a balance on, mirroring the backend registry.
 * Sourced from constants/knownChains.ts so a long-tail holding (Sei, Berachain,
 * HyperEVM, Stacks, …) renders its real chain name instead of "Chain 1329".
 */
export const CHAIN_NAMES: Record<number, string> = {
    ...KNOWN_CHAIN_NAMES,
    ...ALIAS_CHAIN_NAMES,
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
 * Get display name for a chain ID, falling back to a symbol-based guess.
 *
 * The chain id wins whenever we recognise it — ETH is native on 30+ chains, so
 * the symbol map would label a Base or Arbitrum holding "Ethereum". The symbol
 * fallback exists for CEX/market data that carries no chain id at all.
 */
export function getChainName(chainId: number | string | undefined, symbol?: string): string {
    const id = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    if (id && CHAIN_NAMES[id]) return CHAIN_NAMES[id];

    if (symbol) {
        const sym = symbol.toUpperCase();
        if (SYMBOL_TO_CHAIN[sym]) return SYMBOL_TO_CHAIN[sym];
    }

    if (!id) return 'Unknown Chain';
    return `Chain ${id}`;
}
