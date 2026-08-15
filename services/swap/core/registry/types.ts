/**
 * Canonical chain types.
 *
 * Ported verbatim from the web app's `lib/backend/types/backend-tokens.ts` so
 * `registry/chains.ts` (a straight copy of the web registry) compiles unchanged.
 * Keep the two in sync - the registry is the source of truth for which chains
 * the swap engine considers EVM / Cosmos / Solana / … .
 */

export type ChainType =
    | 'EVM'
    | 'Solana'
    | 'Cosmos'
    | 'CosmosAppChain'
    | 'Sui'
    | 'TON'
    | 'Bitcoin'
    | 'TRON'
    | 'Osmosis'
    | 'Aptos'
    | 'Polkadot'
    | 'Starknet';

export interface CanonicalChain {
    id: number;
    name: string;
    type: ChainType;
    logoURI?: string;
    nativeCurrency: {
        symbol: string;
        decimals: number;
    };
    metadata?: {
        chainId?: string;
        rpcUrl?: string;
        explorerUrl?: string;
        [key: string]: any;
    };
    providerIds: {
        lifi?: number | string;
        squid?: string;
        dexscreener?: string;
        relay?: number;
        rubic?: string | number;
    };
}
