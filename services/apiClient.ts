/**
 * Tiwi Backend API Client
 * 
 * Provides unified access to the Tiwi Protocol backend for:
 * - Wallet registration and metadata
 * - Multi-chain balance fetching (EVM + Solana)
 * - Token spotlight and market data
 * - Transaction logging and activity
 */

export const BASE_URL = 'https://app.tiwiprotocol.xyz';
// export const BASE_URL = 'https://tiwi-super-app.vercel.app';
// export const BASE_URL = 'https://81c9-105-112-216-223.ngrok-free.app';

// For local development, you can set this in your environment
export const API_URL = process.env.EXPO_PUBLIC_TIWI_BACKEND_URL || BASE_URL;

export interface APIWallet {
    wallet_address: string;
    source: string;
}

export interface Chain {
    [x: string]: any;
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

export interface EnrichedMarket {
    id: string;
    symbol: string;
    pair?: string;
    price: number | string;
    priceUSD: number | string;
    priceChange24h: number;
    high24h?: number;
    low24h?: number;
    volume24h: number;
    fundingRate?: number;
    openInterest?: number;
    marketCap?: number;
    fdv?: number;
    liquidity?: number;
    circulatingSupply?: number;
    totalSupply?: number;
    maxSupply?: number | null;
    rank?: number;
    marketCapRank?: number;
    baseToken?: {
        symbol: string;
        name: string;
        address: string;
        chainId: number;
        logo: string;
        networkName?: string;
        decimals?: number;
    };
    quoteToken?: {
        symbol: string;
        name: string;
        address: string;
        chainId: number;
        logo: string;
    };
    metadata?: {
        name: string;
        logo: string;
        description?: string;
        socials?: Array<{ type: string; url: string }>;
        websites?: Array<{ label: string; url: string }>;
        website?: string;
    };
    chainId: number;
    networkName?: string;
    contractAddress?: string;
    decimals?: number;
    provider: 'binance' | 'dydx' | 'onchain' | 'dexscreener';
    marketType: 'spot' | 'perp' | 'all';
    displaySymbol?: string; // Derived or optional
    logoURI?: string; // Derived or optional
    address?: string; // Flattened for UI
    name?: string; // Flattened for UI
    logo?: string; // Flattened for UI
    description?: string; // Flattened for UI
}

export interface EnrichedMarketDetailResponse {
    success: boolean;
    data: EnrichedMarket;
}

export interface EnrichedMarketsResponse {
    success: boolean;
    count: number;
    markets: EnrichedMarket[];
}

export interface OrderBookLevel {
    price: string;
    quantity: string;
    total: string;
}

export interface OrderBookData {
    symbol: string;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    lastUpdateId: number;
    timestamp: number;
    currentPrice?: number;
}

export interface ReferralStats {
    totalInvites: number;
    totalBonuses: number;
    claimableRewards: number;
    referralCode: string | null;
    referralLink: string | null;
}

export interface RecentReferralActivity {
    walletAddress: string;
    reward: number;
    timestamp: string;
}

export interface ReferralLeaderboardEntry {
    rank: number;
    walletAddress: string;
    invites: number;
    rewards: number;
}

export interface ReferralRebateStats {
    rebateLevel: number;
    invitedFrens: number;
    frensSpotVol: number;
    frensPerpVol: number;
    mySpotRebate: number;
    myPerpRebate: number;
}

export interface ChartHistoryParams {
    symbol: string;
    resolution: string;
    from: number;
    to: number;
    countback?: number;
}

export interface OHLCBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface ChartHistoryResponse {
    s: 'ok' | 'no_data' | 'error';
    t: number[];
    o: number[];
    h: number[];
    l: number[];
    c: number[];
    v?: number[];
    errmsg?: string;
}

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: 'General' | 'Transactions' | 'Chains' | 'Lending' | 'Staking' | 'Liquidity' | 'NFTs' | 'Referrals' | 'Security' | 'Troubleshooting';
    createdAt: string;
    updatedAt: string;
}

export interface FAQsAPIResponse {
    faqs: FAQ[];
    total: number;
}

export interface Tutorial {
    id: string;
    title: string;
    description: string;
    category: 'Trading' | 'Liquidity' | 'Staking' | 'NFTs' | 'Social' | 'Security' | 'Getting Started' | 'Advanced';
    link: string;
    thumbnailUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TutorialsAPIResponse {
    tutorials: Tutorial[];
    total: number;
}

export interface LiveStatus {
    id: string;
    service: string;
    status: 'operational' | 'degraded' | 'down' | 'maintenance';
    updatedAt: string;
    description?: string;
}

export interface BugReport {
    id: string;
    userWallet: string;
    description: string;
    screenshot?: string;
    logFile?: string;
    deviceInfo?: any;
    status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
    createdAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
}

export interface CreateBugReportRequest {
    userWallet: string;
    description: string;
    screenshot?: string;
    logFile?: string;
    deviceInfo?: any;
}

export interface BugReportsAPIResponse {
    bugReports: BugReport[];
    total: number;
}

export interface LiveStatusResponse {
    statuses: LiveStatus[];
    total: number;
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
    logo?: string;
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
    name: string;
    address: string;
    logo?: string;
    rank: number;
    priceUSD?: string | number;
    chainId?: number;
    change24h?: number;
    pair?: string;
    startDate?: string;
    endDate?: string;
}

export interface TokensResponse {
    chainIds: number[];
    limit: number;
    query: string;
    tokens: TokenMetadata[];
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

export interface APIStakingPool {
    id: string;
    tokenSymbol: string;
    tokenName: string;
    apy: number;
    tokenLogo?: string;
    minStakeAmount?: number;
    maxStakeAmount?: number;
    contractAddress: string;
    chainId: number;
    tokenAddress: string;
    decimals?: number;
    poolId?: number;
    factoryAddress?: string;
    status: 'active' | 'completed' | 'withdrawn';
    minStakingPeriod?: string;
}

export interface APIUserStake {
    id: string;
    userWallet: string;
    stakedAmount: string;
    rewardsEarned: string;
    lockPeriodDays?: number;
    status: 'active' | 'completed' | 'withdrawn';
    pool: APIStakingPool;
    createdAt: string;
    updatedAt: string;
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
    useRelayer?: boolean;
    gasToken?: string;
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

export interface APINFT {
    contractAddress: string;
    tokenId: string;
    name: string;
    description?: string;
    image?: string;
    imageThumbnail?: string;
    chainId: number;
    collectionName?: string;
    collectionSymbol?: string;
    contractType: 'ERC721' | 'ERC1155';
    owner: string;
    amount?: string;
    minterAddress?: string;
    blockNumberMinted?: string;
    blockTimestampMinted?: number;
    attributes?: Array<{
        trait_type: string;
        value: string | number;
    }>;
    floorPrice?: string;
    floorPriceUSD?: string;
    totalVolume?: string;
    totalVolumeUSD?: string;
    owners?: number;
    listed?: number;
    listedPercentage?: number;
    supply?: number;
}

export interface NFTActivity {
    type: 'received' | 'sent' | 'mint' | 'burn' | 'list' | 'sale' | 'transfer' | 'listing' | 'purchase' | 'unlisted';
    date: string;
    timestamp: number;
    nftName: string;
    price?: string;
    priceUSD?: string;
    from?: string;
    to?: string;
    transactionHash: string;
    id?: string;
}

export interface APINFTDetail extends APINFT {
    activities?: NFTActivity[];
}

export interface NFTActivityResponse {
    activities: NFTActivity[];
    total: number;
    address: string;
    contractAddress: string;
    tokenId: string;
    chainId: number;
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
            const data = await response.json();
            return data
        } catch (error) {
            console.warn(`[TiwiAPI] Error fetching ${endpoint}:`, error);
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
     * Get all supported chains, optionally filtered by ecosystems (e.g., ['evm', 'solana'])
     */
    async getChains(ecosystems?: string[]): Promise<Chain[]> {
        const query = ecosystems ? `?type=${ecosystems.join(',')}` : '';
        const response = await this.fetcher<{ chains: Chain[] }>(`/api/v1/chains${query}`);
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
    }): Promise<TokensResponse> {
        const query = new URLSearchParams();
        if (params.address) query.append('address', params.address);
        if (params.query) query.append('query', params.query);
        if (params.chains) query.append('chains', params.chains.join(','));
        if (params.limit) query.append('limit', params.limit.toString());

        const response = await this.fetcher<TokensResponse>(`/api/v1/tokens?${query.toString()}`);
        return response;
    }

    async getMarketPairs(params: {
        category: 'hot' | 'new' | 'gainers' | 'losers';
        limit?: number;
        chains?: number[];
    }): Promise<MarketTokenPair[]> {
        const query = new URLSearchParams();
        query.append('category', params.category);
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.chains && params.chains.length > 0) {
            query.append('chainIds', params.chains.join(','));
        }

        const response = await this.fetcher<{ tokens: MarketTokenPair[] }>(`/api/v1/tokens?${query.toString()}`);

        return response.tokens;
    }

    /**
     * Get enriched market list (unified spot and perps)
     */
    async getEnrichedMarkets(params: {
        marketType?: 'spot' | 'perp' | 'all';
        limit?: number;
    } = {}): Promise<EnrichedMarket[]> {
        const query = new URLSearchParams();
        if (params.marketType) query.append('marketType', params.marketType);
        if (params.limit) query.append('limit', params.limit.toString());

        const response = await this.fetcher<EnrichedMarketsResponse>(`/api/v1/market/list?${query.toString()}`);
        return response.markets || [];
    }

    async getEnrichedMarketDetail(
        symbol: string,
        options: {
            provider?: 'binance' | 'dydx' | 'onchain' | 'dexscreener';
            address?: string;
            chainId?: number;
            marketType?: 'spot' | 'perp' | 'all';
        } = {}
    ): Promise<EnrichedMarket> {
        const query = new URLSearchParams();
        if (options.address) query.append('address', options.address);
        if (options.chainId) query.append('chainId', options.chainId.toString());
        if (options.marketType) query.append('marketType', options.marketType);

        const queryString = query.toString() ? `?${query.toString()}` : '';
        const response = await this.fetcher<EnrichedMarketDetailResponse>(`/api/v1/market/${symbol}${queryString}`);
        return response.data;
    }

    /**
     * Get orderbook snapshot for a pair
     */
    async getOrderBook(symbol: string, options: {
        address?: string;
        chainId?: number;
        marketType?: 'spot' | 'perp';
    } = {}): Promise<OrderBookData> {
        const query = new URLSearchParams();
        if (options.address) query.append('address', options.address);
        if (options.chainId) query.append('chainId', options.chainId.toString());
        if (options.marketType) query.append('marketType', options.marketType);

        const queryString = query.toString() ? `?${query.toString()}` : '';
        return this.fetcher<OrderBookData>(`/api/v1/market/${symbol}/orderbook${queryString}`);
    }

    /**
     * Get historical chart data (OHLC)
     */
    async getChartHistory(params: ChartHistoryParams): Promise<ChartHistoryResponse> {
        const query = new URLSearchParams({
            symbol: params.symbol,
            resolution: params.resolution,
            from: params.from.toString(),
            to: params.to.toString(),
        });

        if (params.countback) query.append('countback', params.countback.toString());

        return this.fetcher<ChartHistoryResponse>(`/api/v1/charts/history?${query.toString()}`);
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
            console.error('[TiwiAPI] logTransaction failed:', e);
            return false;
        }
    }

    /**
     * Log an NFT activity performed via the app
     */
    async logNFTActivity(activityData: {
        walletAddress: string;
        transactionHash: string;
        chainId: number;
        contractAddress: string;
        tokenId: string;
        type: 'mint' | 'transfer' | 'sent' | 'received' | 'sale' | 'purchase' | 'listing' | 'unlisting';
        fromAddress?: string;
        toAddress?: string;
        price?: string;
        priceUSD?: number;
        blockTimestamp?: string;
    }): Promise<boolean> {
        try {
            await this.fetcher('/api/v1/nft/activity', {
                method: 'POST',
                body: JSON.stringify(activityData),
            });
            return true;
        } catch (e) {
            console.error('[TiwiAPI] logNFTActivity failed:', e);
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
     * Submit a signed swap to the relayer
     */
    async executeRelayerSwap(params: {
        signature: string;
        quoteId: string;
        chainId: number;
        fromAddress: string;
    }): Promise<{ success: boolean; txHash?: string; error?: string }> {
        return this.fetcher<{ success: boolean; txHash?: string; error?: string }>('/api/v1/relayer/execute', {
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

    /**
     * Get NFTs for a wallet address from the backend
     */
    async getNFTs(address: string, chains?: number[]): Promise<APINFT[]> {
        const query = new URLSearchParams();
        query.append('address', address);
        if (chains && chains.length > 0) {
            query.append('chains', chains.join(','));
        }

        const response = await this.fetcher<{ nfts: APINFT[] }>(`/api/v1/nft/wallet?${query.toString()}`);
        return response.nfts;
    }

    /**
     * Get detailed NFT information
     */
    async getNFTDetail(id: string): Promise<APINFTDetail> {
        return this.fetcher<APINFTDetail>(`/api/v1/nfts/${id}`);
    }

    /**
     * Get NFT activities for a specific NFT
     */
    async getNFTActivity(params: {
        address: string;
        chainId: number;
        contractAddress: string;
        tokenId: string;
        limit?: number;
    }): Promise<NFTActivityResponse> {
        const query = new URLSearchParams();
        query.append('address', params.address);
        query.append('chainId', params.chainId.toString());
        query.append('contractAddress', params.contractAddress);
        query.append('tokenId', params.tokenId);
        if (params.limit) query.append('limit', params.limit.toString());

        return this.fetcher<NFTActivityResponse>(`/api/v1/nft/activity?${query.toString()}`);
    }

    /**
     * Get active staking pools from the backend
     */
    async getStakingPools(status: string = 'active'): Promise<APIStakingPool[]> {
        const query = new URLSearchParams();
        query.append('status', status);
        const response = await this.fetcher<{ pools: APIStakingPool[] }>(`/api/v1/staking-pools?${query.toString()}`);
        return response.pools;
    }

    /**
     * Get referral stats for a wallet
     */
    async getReferralStats(walletAddress: string): Promise<ReferralStats> {
        const response = await this.fetcher<{ stats: ReferralStats }>(`/api/v1/referrals?walletAddress=${walletAddress}&action=stats`);
        return response.stats;
    }

    /**
     * Get recent referral activity
     */
    async getRecentReferralActivity(limit: number = 5, walletAddress?: string): Promise<RecentReferralActivity[]> {
        const query = new URLSearchParams();
        query.append('action', 'activity');
        query.append('limit', limit.toString());
        if (walletAddress) query.append('walletAddress', walletAddress);

        const response = await this.fetcher<{ activity: RecentReferralActivity[] }>(`/api/v1/referrals?${query.toString()}`);
        return response.activity;
    }

    /**
     * Get referral leaderboard
     */
    async getReferralLeaderboard(limit: number = 10): Promise<ReferralLeaderboardEntry[]> {
        const response = await this.fetcher<{ leaderboard: ReferralLeaderboardEntry[] }>(`/api/v1/referrals?action=leaderboard&limit=${limit}`);
        return response.leaderboard;
    }

    /**
     * Get rebate stats for a wallet
     */
    async getRebateStats(walletAddress: string): Promise<ReferralRebateStats> {
        const response = await this.fetcher<{ rebateStats: ReferralRebateStats }>(`/api/v1/referrals?walletAddress=${walletAddress}&action=rebate`);
        return response.rebateStats;
    }

    /**
     * Create a referral code for a wallet
     */
    async createReferralCode(walletAddress: string, customCode?: string): Promise<{ success: boolean; code: string; link: string }> {
        return this.fetcher<{ success: boolean; code: string; link: string }>('/api/v1/referrals', {
            method: 'POST',
            body: JSON.stringify({
                action: 'create',
                walletAddress,
                customCode
            }),
        });
    }

    async applyReferralCode(walletAddress: string, referralCode: string): Promise<{ success: boolean; message: string }> {
        return this.fetcher<{ success: boolean; message: string }>('/api/v1/referrals', {
            method: 'POST',
            body: JSON.stringify({
                action: 'apply',
                walletAddress,
                referralCode
            }),
        });
    }

    /**
     * Validate if a referral code exists (case-insensitive)
     */
    async validateReferralCode(code: string): Promise<{ valid: boolean }> {
        return this.fetcher<{ valid: boolean }>(`/api/v1/referrals?action=validate&code=${code}`);
    }

    /**
     * Get user stakes from the backend
     */
    async getUserStakes(userWallet: string, status?: string): Promise<APIUserStake[]> {
        const query = new URLSearchParams();
        query.append('userWallet', userWallet);
        if (status) {
            query.append('status', status);
        }
        const response = await this.fetcher<{ stakes: APIUserStake[] }>(`/api/v1/user-stakes?${query.toString()}`);
        return response.stakes;
    }

    /**
     * Get smart markets (DEXes and Bridges) from LI.FI API
     * Provides real-time integrations supported by the protocol.
     */
    async getSmartMarkets(): Promise<{ id: string; name: string; logo: string }[]> {
        try {
            // Using LI.FI's tools endpoint to get supported exchanges
            const response = await fetch('https://li.quest/v1/tools');
            if (!response.ok) throw new Error('Failed to fetch tools from LI.FI');

            const data = await response.json();

            // Map exchanges and bridges to a unified format
            const exchanges = (data.exchanges || []).map((ex: any) => ({
                id: ex.key,
                name: ex.name,
                logo: ex.logoURI
            }));

            const bridges = (data.bridges || []).map((br: any) => ({
                id: br.key,
                name: br.name,
                logo: br.logoURI
            }));

            // Return a curated unique list
            return [...exchanges, ...bridges].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        } catch (error) {
            console.error('[TiwiAPI] Error fetching smart markets:', error);
            // Fallback to a minimal curated list if API fails
            return [
                { id: 'uniswap', name: 'Uniswap', logo: 'https://cryptologos.cc/logos/uniswap-uni-logo.png' },
                { id: '1inch', name: '1inch', logo: 'https://cryptologos.cc/logos/1inch-1inch-logo.png' },
                { id: 'pancakeswap', name: 'PancakeSwap', logo: 'https://cryptologos.cc/logos/pancakeswap-cake-logo.png' },
                { id: 'sushiswap', name: 'Sushiswap', logo: 'https://cryptologos.cc/logos/sushiswap-sushi-logo.png' }
            ];
        }
    }

    /**
     * Enrich spotlight tokens with metadata from DexScreener (Logos, ChainIds, Price Change)
     * Includes a self-healing fallback for malformed or missing addresses.
     */
    async enrichSpotlightTokens(tokens: SpotlightToken[]): Promise<SpotlightToken[]> {
        if (!tokens || tokens.length === 0) return tokens;

        // Stage 1: Batch address-based lookup
        const validAddresses = tokens
            .map(t => t.address)
            .filter(a => a && a.length > 30 && !a.includes('...'));

        let pairs: any[] = [];
        if (validAddresses.length > 0) {
            try {
                const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${validAddresses.join(',')}`);
                if (response.ok) {
                    const data = await response.json();
                    pairs = data.pairs || [];
                }
            } catch (error) {
                console.error('[TiwiAPI] DexScreener batch fetch error:', error);
            }
        }

        // Processing tokens with direct matches or falling back to search
        const enrichedTokens = await Promise.all(tokens.map(async (token) => {
            const tokenAddr = token.address.toLowerCase();
            const isAddressMalformed = !token.address || token.address.length < 30 || token.address.includes('...');

            // Try to find direct pairs first
            let matchingPairs = pairs.filter((p: any) =>
                p.baseToken.address.toLowerCase() === tokenAddr ||
                p.quoteToken.address.toLowerCase() === tokenAddr
            );

            // Stage 2: Fallback to Search (DexScreener + Tiwi Backend)
            if (matchingPairs.length === 0 || isAddressMalformed) {
                try {
                    const searchQuery = token.name || token.symbol;

                    // Attempt 1: DexScreener Search
                    const searchRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`);
                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        const searchPairs = searchData.pairs || [];
                        const bestMatches = searchPairs.filter((p: any) =>
                            p.baseToken.symbol.toLowerCase() === token.symbol.toLowerCase()
                        ).sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

                        if (bestMatches.length > 0) {
                            matchingPairs = bestMatches;
                            token.address = bestMatches[0].baseToken.address;
                        }
                    }

                    // Attempt 2: Tiwi Backend Search (Prioritize for Logo)
                    if (matchingPairs.length === 0 || !token.logo || token.logo.includes('default.svg')) {
                        const tokenSearchRes = await this.getTokens({ query: searchQuery, limit: 1 });
                        if (tokenSearchRes.tokens && tokenSearchRes.tokens.length > 0) {
                            const tiwiToken = tokenSearchRes.tokens[0];
                            token.logo = tiwiToken.logoURI || token.logo;
                            // If we still don't have an address, take it from backend
                            if (isAddressMalformed) {
                                token.address = tiwiToken.address;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[TiwiAPI] Fallback search failed for ${token.symbol}:`, e);
                }
            }

            if (matchingPairs.length === 0) return token;

            // Sort by liquidity for primary market source
            const sortedPairs = [...matchingPairs].sort((a: any, b: any) =>
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            );
            const primaryPair = sortedPairs[0];

            // Intelligent Logo Hunting
            let foundLogo = sortedPairs.find(p =>
                p.baseToken.address.toLowerCase() === token.address.toLowerCase() &&
                (p.info?.imageUrl || p.info?.icon)
            )?.info?.imageUrl || sortedPairs.find(p =>
                p.baseToken.address.toLowerCase() === token.address.toLowerCase() &&
                (p.info?.imageUrl || p.info?.icon)
            )?.info?.icon;

            if (!foundLogo) {
                foundLogo = sortedPairs.find(p => (p.info?.imageUrl || p.info?.icon))?.info?.imageUrl ||
                    sortedPairs.find(p => (p.info?.imageUrl || p.info?.icon))?.info?.icon;
            }

            const dsChainId = primaryPair.chainId;
            const mappedChainId = DEXSCREENER_CHAIN_MAP[dsChainId] || token.chainId || 56;

            return {
                ...token,
                logo: token.logo && !token.logo.includes('default.svg') ? token.logo : foundLogo,
                chainId: mappedChainId,
                priceUSD: primaryPair.priceUsd,
                change24h: primaryPair.priceChange?.h24 || 0,
                pair: `${primaryPair.baseToken.symbol}-${primaryPair.quoteToken.symbol}`,
            };
        }));

        return enrichedTokens;
    }

    /**
     * Get live status for all protocol services
     */
    async getLiveStatus(): Promise<LiveStatusResponse> {
        return this.fetcher<LiveStatusResponse>('/api/v1/live-status');
    }

    /**
     * Get FAQs from the support service
     */
    async getFAQs(): Promise<FAQsAPIResponse> {
        return this.fetcher<FAQsAPIResponse>('/api/v1/support/faqs');
    }

    /**
     * Get Tutorials from the support service
     */
    async getTutorials(): Promise<TutorialsAPIResponse> {
        return this.fetcher<TutorialsAPIResponse>('/api/v1/support/tutorials');
    }

    /**
     * Upload a file to the backend
     */
    async uploadFile(fileUri: string, fileName: string, fileType: string, folder: string = 'bug-reports'): Promise<{ url: string } | null> {
        try {
            const formData = new FormData();
            // @ts-ignore - React Native FormData expects an object for file
            formData.append('file', {
                uri: fileUri,
                name: fileName,
                type: fileType,
            });
            formData.append('folder', folder);

            const response = await fetch(`${this.baseUrl}/api/v1/upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                    // Note: In React Native, don't set Content-Type for FormData, it sets it automatically with boundary
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Upload Error: ${response.status}`);
            }

            const data = await response.json();
            return { url: data.url };
        } catch (error) {
            console.error('[TiwiAPI] uploadFile failed:', error);
            return null;
        }
    }

    /**
     * Report a bug
     */
    async reportBug(data: CreateBugReportRequest): Promise<{ success: boolean; bugReport: BugReport }> {
        return this.fetcher<{ success: boolean; bugReport: BugReport }>('/api/v1/bug-reports', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

/**
 * Mapping DexScreener chain slugs to numeric chain IDs
 */
export const DEXSCREENER_CHAIN_MAP: Record<string, number> = {
    'ethereum': 1,
    'bsc': 56,
    'solana': 1399811149,
    'polygon': 137,
    'arbitrum': 42161,
    'base': 8453,
    'optimism': 10,
    'avalanche': 43114,
    'fantom': 250,
    'zksync': 324,
    'linea': 59144,
    'blast': 81457,
    'cronos': 25,
    'mantle': 5000,
    'metis': 1088,
    'neon': 245022934,
    'oasis': 42262,
    'pulse': 369,
    'scroll': 534352,
    'sei': 1329,
    'zora': 7777777,
    'moonbeam': 1284,
    'moonriver': 1285,
    'celo': 42220,
    'gnosis': 100,
    'aurora': 1313161554,
    'luck': 10,
    'manta': 169,
    'kava': 2222,
    'fuse': 122,
    'meter': 82,
};

export const apiClient = new TiwiApiClient(API_URL);
