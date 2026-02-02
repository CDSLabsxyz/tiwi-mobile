/**
 * Tiwi Backend API Client
 * 
 * Provides unified access to the Tiwi Protocol backend for:
 * - Wallet registration and metadata
 * - Multi-chain balance fetching (EVM + Solana)
 * - Token spotlight and market data
 * - Transaction logging and activity
 */

// const BASE_URL = 'https://app.tiwiprotocol.xyz';
const BASE_URL = 'https://tiwi-super-app.vercel.app';
// const BASE_URL = 'https://3eb5f8808c3f.ngrok-free.app';

// For local development, you can set this in your environment
const API_URL = process.env.EXPO_PUBLIC_TIWI_BACKEND_URL || BASE_URL;

export interface APIWallet {
    wallet_address: string;
    source: string;
}

export interface Chain {
    [x: string]: string;
    id: number;
    name: string;
    slug: string;
    type: string;
    logo?: string;
    logoURI?: string;
    isMainnet: boolean;
    nativeCurrency?: {
        symbol: string;
        decimals: number;
    };
    supportedProviders?: string[];
}

export interface MarketToken {
    chainId: number;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI: string;
    priceUSD: string;
    verified: boolean;
    chainBadge?: string;
    chainName?: string;
}

export interface MarketTokenPair {
    chainId: number;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI: string;
    priceUSD: string;
    verified: boolean;
    chainBadge?: string;
    chainName?: string;
    volume24h?: number;
    marketCap?: number;
    priceChange24h?: number;
    marketCapRank?: number;
    circulatingSupply?: number;
    totalSupply?: number;
    maxSupply?: number;
    holders?: number;
    transactionCount?: number;
    website?: string;
    twitter?: string;
    liquidity?: number;
    high24h?: number;
    low24h?: number;
}

export interface TokenMetadata extends Omit<APIToken, 'balance' | 'balanceFormatted' | 'priceChange24h'> {
    circulatingSupply?: number;
    totalSupply?: number;
    maxSupply?: number;
    holders?: number;
    transactionCount?: number;
    volume24h?: number;
    marketCap?: number;
    marketCapRank?: number;
    chainBadge?: string;
    chainName?: string;
    website?: string;
    twitter?: string;
    liquidity?: number;
    high24h?: number;
    low24h?: number;
    priceChange24h?: number;
    description?: string;
}

export interface APIToken {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
    balanceFormatted: string;
    chainId: number;
    logoURI?: string;
    priceUSD?: string;
    usdValue?: string;
    priceChange24h?: string;
    verified?: boolean;
}

export interface WalletBalancesResponse {
    address: string;
    balances: APIToken[];
    totalUSD: string;
    chains: number[];
    timestamp: number;
}

export interface SpotlightToken {
    id: string;
    symbol: string;
    name?: string;
    address?: string;
    logo?: string;
    rank: number;
    startDate: string;
    endDate: string;
}

export interface MarketPriceResponse {
    pair: string;
    price: number;
    priceUSD: number;
    priceChange24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    baseToken: {
        symbol: string;
        address: string;
        priceUSD: number;
    };
    quoteToken: {
        symbol: string;
        address: string;
        priceUSD: number;
    };
}

export interface FetchRouteParams {
    fromToken: {
        chainId: number;
        address: string;
        symbol?: string;
        decimals?: number;
    };
    toToken: {
        chainId: number;
        address: string;
        symbol?: string;
        decimals?: number;
    };
    fromAmount?: string;
    toAmount?: string;
    slippage?: number;
    slippageMode?: 'fixed' | 'auto';
    fromAddress?: string;
    recipient?: string;
    order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST';
    liquidityUSD?: number;
}

export interface RouteAPIResponse {
    route: {
        router: string;
        routeId: string;
        fromToken: {
            address: string;
            symbol: string;
            amount: string;
            amountUSD?: string;
            chainId: number;
        };
        toToken: {
            address: string;
            symbol: string;
            amount: string;
            amountUSD?: string;
            chainId: number;
        };
        steps?: any[];
        fees: {
            protocol: string;
            gas: string;
            gasUSD: string;
            total: string;
        };
        priceImpact?: string;
        slippage?: string;
        transactionRequest?: {
            to: string;
            data: string;
            value: string;
        };
        transactionData?: string;
        raw?: any;
    };
    alternatives?: any[];
    raw?: any;
    timestamp: number;
    expiresAt: number;
    error?: string;
}

export interface TransactionHistoryItem {
    id: string;
    hash: string;
    type: 'Swap' | 'Sent' | 'Received' | 'Stake' | 'Unstake' | 'Approve' | 'Transfer';
    from: string;
    to: string;
    tokenSymbol: string;
    tokenAddress: string;
    amount: string;
    amountFormatted: string;
    usdValue: string;
    chainId: number;
    timestamp: number;
    status: 'pending' | 'completed' | 'failed';
}

export interface TransactionHistoryResponse {
    address: string;
    transactions: TransactionHistoryItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    timestamp: number;
}

class TiwiApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[TiwiAPI] Error fetching ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Register a wallet address with the backend
     */
    async registerWallet(address: string, source: string = 'local'): Promise<boolean> {
        try {
            await this.fetcher('/api/v1/wallets', {
                method: 'POST',
                body: JSON.stringify({ address, source }),
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get balances for a wallet across specified chains
     */
    async getWalletBalances(address: string, chains?: number[]): Promise<WalletBalancesResponse> {
        const chainsParam = chains ? `?chains=${chains.join(',')}` : '';
        const result = await this.fetcher<WalletBalancesResponse>(`/api/v1/wallet/balances?address=${address}${chainsParam ? `&${chainsParam.slice(1)}` : ''}`);
        return result;
    }

    /**
     * Get dynamic spotlight tokens for the home screen
     */
    async getSpotlightTokens(activeOnly: boolean = true): Promise<SpotlightToken[]> {
        const response = await this.fetcher<{ tokens: SpotlightToken[] }>(`/api/v1/token-spotlight?activeOnly=${activeOnly}`);
        return response.tokens;
    }

    /**
     * Get market price for a specific pair (e.g., TWC-USDT)
     */
    async getMarketPrice(pair: string, chainId: number = 56): Promise<MarketPriceResponse> {
        return this.fetcher<MarketPriceResponse>(`/api/v1/market/${pair}/price?chainId=${chainId}`);
    }

    /**
     * Get all supported chains
     */
    async getChains(): Promise<Chain[]> {
        const response = await this.fetcher<{ chains: Chain[] }>('/api/v1/chains');
        return response.chains;
    }

    /**
     * Get detailed token metadata
     */
    async getTokens(params: {
        address?: string;
        chains?: number[];
        limit?: number;
        query?: string;
    }): Promise<TokenMetadata[]> {
        const query = new URLSearchParams();
        if (params.address) query.append('address', params.address);
        if (params.query) query.append('query', params.query);
        if (params.chains) query.append('chains', params.chains.join(','));
        if (params.limit) query.append('limit', params.limit.toString());

        const response = await this.fetcher<{ tokens: TokenMetadata[] }>(`/api/v1/tokens?${query.toString()}`);
        return response.tokens;
    }

    /**
     * Get market pairs by category (now using tokens endpoint)
     */
    async getMarketPairs(params: {
        category: 'hot' | 'new' | 'gainers' | 'losers';
        limit?: number;
        chains?: number[];
    }): Promise<MarketTokenPair[]> {
        const query = new URLSearchParams();
        query.append('category', params.category);
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.chains && params.chains.length > 0) {
            query.append('chains', params.chains.join(','));
        }

        const response = await this.fetcher<{ tokens: MarketTokenPair[] }>(`/api/v1/tokens?${query.toString()}`);

        return response.tokens;
    }

    /**
     * Log a transaction performed via the app
     */
    async logTransaction(txData: {
        walletAddress: string;
        transactionHash: string;
        chainId: number;
        type: string;
        fromTokenAddress?: string;
        fromTokenSymbol?: string;
        toTokenAddress?: string;
        toTokenSymbol?: string;
        amount: string;
        amountFormatted: string;
        usdValue?: number;
        routerName?: string;
        blockNumber?: number;
        blockTimestamp?: string;
    }): Promise<boolean> {
        try {
            await this.fetcher('/api/v1/tiwi/transactions', {
                method: 'POST',
                body: JSON.stringify(txData),
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Fetch a swap route from the backend
     */
    async fetchRoute(params: FetchRouteParams): Promise<RouteAPIResponse> {
        return this.fetcher<RouteAPIResponse>('/api/v1/route', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * Get transaction history for a wallet
     */
    async getTransactionHistory(params: {
        address: string;
        chains?: number[];
        types?: string[];
        limit?: number;
        offset?: number;
    }): Promise<TransactionHistoryResponse> {
        const query = new URLSearchParams();
        query.append('address', params.address);
        if (params.chains) query.append('chains', params.chains.join(','));
        if (params.types) query.append('types', params.types.join(','));
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.offset) query.append('offset', params.offset.toString());

        return this.fetcher<TransactionHistoryResponse>(`/api/v1/wallet/transactions?${query.toString()}`);
    }
}

export const apiClient = new TiwiApiClient(API_URL);
