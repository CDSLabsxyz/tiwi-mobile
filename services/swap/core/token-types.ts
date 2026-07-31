/**
 * Token / Chain shapes used by the swap executors.
 *
 * Mirrors the web app's `lib/frontend/types/tokens.ts`. The mobile swap screen
 * works with the leaner `TokenMinimal` (services/swap/types.ts); the adapter in
 * services/swap/route-adapter.ts widens it into this shape before handing a
 * route to the executor engine.
 */

export interface Token {
    id?: string;
    name?: string;
    symbol: string;
    address: string;
    logo?: string;
    logoURI?: string;
    chain?: string;
    chainId?: number;
    chainLogo?: string;
    decimals: number | undefined;
    balance?: string;
    usdValue?: string;
    price?: string;
    chainBadge?: string;
    verified?: boolean;
    priceChange24h?: number;
    volume24h?: number;
    high24h?: number;
    low24h?: number;
    liquidity?: number;
    marketCap?: number;
    fdv?: number;
    holders?: number;
    transactionCount?: number;
    isHoneypot?: boolean;
    marketCapRank?: number;
    circulatingSupply?: number;
    totalSupply?: number;
    socials?: unknown[];
    website?: string;
    description?: string;
    baseToken?: unknown;
    quoteToken?: unknown;
    pairPrice?: string;
    pair?: unknown;
    hasSpot?: boolean;
    hasPerp?: boolean;
}

export interface Chain {
    id: string;
    name: string;
    logo: string;
    type?: string;
    symbol?: string;
    decimals?: number;
}
