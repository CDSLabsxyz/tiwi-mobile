/**
 * TIWI Protocol — Mobile API Client
 *
 * A typed, isomorphic HTTP client for all /api/v1/* endpoints.
 * Works in React Native / Expo (no dependency on `window.location`).
 *
 * Usage:
 *   import { TiwiApiClient } from '@/lib/mobile/api-client';
 *   const api = new TiwiApiClient('https://app.tiwiprotocol.xyz');
 *
 *   const { tokens } = await api.tokens.list({ category: 'hot', limit: 30 });
 *   const info      = await api.tokenInfo.get(56, '0xDA1060...');
 *   const route     = await api.route.get({ fromChainId: 56, fromToken: '0x...', ... });
 */

// ─── Base URL ────────────────────────────────────────────────────────────────

/** Production base URL. Override per environment. */
export const TIWI_API_BASE_URL =
    process.env.EXPO_PUBLIC_TIWI_BACKEND_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://app.tiwiprotocol.xyz';

// ─── Generic fetch helper ─────────────────────────────────────────────────────

async function apiFetch<T>(
    baseUrl: string,
    path: string,
    options?: RequestInit,
    params?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
    const url = new URL(path, baseUrl);

    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.set(k, String(v));
            }
        });
    }

    const res = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
        ...options,
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(
            errorBody?.error ?? `TIWI API error ${res.status}: ${res.statusText}`
        );
    }

    return res.json() as Promise<T>;
}

// ─── Response shapes (mirrors server types) ───────────────────────────────────

export interface TokenItem {
    id: string;
    symbol: string;
    name: string;
    address: string;
    chainId: number;
    chainName?: string;
    logoURI?: string;
    decimals?: number;
    priceUSD?: string;
    priceChange24h?: number;
    volume24h?: number;
    liquidity?: number;
    marketCap?: number;
    marketCapRank?: number;
    holders?: number;
    transactionCount?: number;
    circulatingSupply?: number;
    totalSupply?: number;
}

export interface TokensResponse {
    tokens: TokenItem[];
    total: number;
    chainIds: number[];
    query: string;
    limit: number;
}

export interface MarketAsset {
    id: string;
    symbol: string;
    name: string;
    address: string;
    chainId: number;
    price: string;
    priceChange24h: number;
    marketCap: number;
    rank: number;
    volume24h: number;
    marketType: 'spot' | 'perp';
    provider: string;
    logo: string | null;
    logoURI: string | null;
    hasSpot: boolean;
    hasPerp: boolean;
    tradableOn: 'aster' | 'binance' | null;
    verified: boolean;
}

export interface MarketListResponse {
    success: boolean;
    count: number;
    markets: MarketAsset[];
}

export interface ChainItem {
    id: number;
    name: string;
    type: string;
    logoURI?: string;
    nativeCurrency?: { name: string; symbol: string; decimals: number };
}

export interface ChainsResponse {
    chains: ChainItem[];
    total: number;
}

export interface TokenInfoResponse {
    token: {
        address: string;
        name: string;
        symbol: string;
        decimals: number;
        logo: string;
        description?: string;
        website?: string;
        twitter?: string;
        telegram?: string;
        discord?: string;
        coingeckoId?: string;
    };
    pool?: {
        address: string;
        name: string;
        dex: string;
        liquidity: number;
        volume24h: number;
        priceUsd: number;
        priceChange24h: number;
        priceChange1h: number;
        priceChange5m: number;
        fdv: number;
        marketCap: number;
        txns24h: number;
        buys24h: number;
        sells24h: number;
        createdAt?: string;
    };
    transactions: Array<{
        type: 'buy' | 'sell';
        priceUsd: number;
        amount: number;
        valueUsd: number;
        maker: string;
        txHash: string;
        timestamp: string;
    }>;
    holders?: number;
    score?: number;
    chainId?: number;
}

export interface SecurityResponse {
    chainId: number;
    address: string;
    verdict: 'safe' | 'warning' | 'danger' | 'unknown';
    score: number;
    providers: Record<string, any>;
}

/** Flat token balance entry as returned by /api/v1/wallet/balances */
export interface WalletBalance {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;           // Raw balance (smallest unit)
    balanceFormatted: string;  // Human-readable formatted balance
    chainId: number;
    logoURI?: string;
    usdValue?: string;         // USD value of the balance
    priceUSD?: string;         // Price per token in USD
    priceChange24h?: string;   // 24h price change %
    portfolioPercentage?: string;
    verified?: boolean;
}

export interface WalletBalanceResponse {
    address: string;
    balances: WalletBalance[];
    totalUSD: string;
    dailyChange?: number;      // Daily percentage change (weighted average)
    dailyChangeUSD?: string;   // Daily USD change (absolute value)
    chains: number[];
    timestamp: number;
}

export interface RouteToken {
    chainId: number;
    address: string;
    symbol?: string;
    decimals?: number;
}

export interface RouteRequest {
    fromToken: RouteToken;
    toToken: RouteToken;
    fromAmount?: string;
    toAmount?: string;
    slippage?: number;
    slippageMode?: 'fixed' | 'auto';
    recipient?: string;
    fromAddress?: string;
    order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST';
    liquidityUSD?: number;
}

export interface RouteResponse {
    route: any;
    alternatives?: any[];
    timestamp: number;
    expiresAt: number;
    error?: string;
}

export interface StakingPool {
    id: string;
    chainId: number;
    chainName: string;
    tokenAddress: string;
    tokenSymbol?: string;
    tokenName?: string;
    tokenLogo?: string;
    decimals?: number;
    minStakeAmount: number;
    maxStakeAmount?: number;
    apy?: number;
    status: 'active' | 'inactive' | 'archived';
    contractAddress?: string;
    poolId?: number;
    createdAt: string;
    updatedAt: string;
}

export interface StakingPoolsResponse {
    pools: StakingPool[];
    total: number;
}

export interface Notification {
    id: string;
    title: string;
    messageBody: string;
    status: string;
    targetAudience: string;
    deliveryType: string;
    priority: string;
    createdAt: string;
    createdBy?: string;
    scheduledFor?: string;
}

export interface NotificationsResponse {
    notifications: Notification[];
    total: number;
    unreadCount?: number;
}

export interface FaqItem {
    id: string;
    question: string;
    answer: string;
    category?: string;
    order?: number;
}

export interface FaqsResponse {
    faqs: FaqItem[];
    total: number;
}

export interface TutorialItem {
    id: string;
    title: string;
    description?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    order?: number;
}

export interface TutorialsResponse {
    tutorials: TutorialItem[];
    total: number;
}

export interface AdvertItem {
    id: string;
    title: string;
    imageUrl: string;
    linkUrl?: string;
    status: string;
}

export interface AdvertsResponse {
    adverts: AdvertItem[];
    total: number;
}

// ─── API Modules ──────────────────────────────────────────────────────────────

/** Tokens */
class TokensModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/tokens
     * List / search tokens.
     */
    list(params?: {
        chains?: number[];
        query?: string;
        limit?: number;
        address?: string;
        category?: 'hot' | 'new' | 'gainers' | 'losers' | 'trending';
        source?: 'market' | 'default' | 'dexscreener';
        marketType?: 'spot' | 'perp';
    }): Promise<TokensResponse> {
        const flat: Record<string, string | number | boolean | undefined | null> = {};
        if (params?.chains?.length) flat.chains = params.chains.join(',');
        if (params?.query) flat.query = params.query;
        if (params?.limit) flat.limit = params.limit;
        if (params?.address) flat.address = params.address;
        if (params?.category) flat.category = params.category;
        if (params?.source) flat.source = params.source;
        if (params?.marketType) flat.marketType = params.marketType;
        return apiFetch(this.base, '/api/v1/tokens', undefined, flat);
    }
}

/** Market List */
class MarketModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/market/list
     * Unified market list (CMC > CoinGecko > Binance > Aster).
     */
    list(params?: {
        marketType?: string;
        limit?: number;
    }): Promise<MarketListResponse> {
        return apiFetch(this.base, '/api/v1/market/list', undefined, {
            marketType: params?.marketType,
            limit: params?.limit,
        });
    }

    /**
     * GET /api/v1/market/{pair}
     * OHLCV / price data for a trading pair (e.g. "BTCUSDT").
     */
    pair(pair: string): Promise<any> {
        return apiFetch(this.base, `/api/v1/market/${encodeURIComponent(pair)}`);
    }

    /**
     * GET /api/v1/market/{pair}/price
     * Current price for a pair.
     */
    pairPrice(pair: string): Promise<any> {
        return apiFetch(this.base, `/api/v1/market/${encodeURIComponent(pair)}/price`);
    }

    /**
     * GET /api/v1/market/{pair}/orderbook
     * Orderbook depth for a pair.
     */
    orderbook(pair: string): Promise<any> {
        return apiFetch(this.base, `/api/v1/market/${encodeURIComponent(pair)}/orderbook`);
    }

    /**
     * GET /api/v1/market-pairs
     * Paginated market pairs by category.
     */
    pairs(params: {
        category: 'hot' | 'new' | 'gainers' | 'losers';
        limit?: number;
        network?: string;
        page?: number;
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/market-pairs', undefined, {
            category: params.category,
            limit: params.limit,
            network: params.network,
            page: params.page,
        });
    }
}

/** Token Info (DexScreener / GeckoTerminal) */
class TokenInfoModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/token-info/{chainId}/{address}
     * Full token details: pool data, socials, recent trades.
     */
    get(chainId: number, address: string): Promise<TokenInfoResponse> {
        return apiFetch(this.base, `/api/v1/token-info/${chainId}/${address}`);
    }
}

/** Token Security Scanner */
class SecurityModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/token/security/{chainId}/{address}
     * Unified security verdict (GoPlus, QuickIntel, TokenSniffer).
     * Only EVM contract addresses (0x…) are supported.
     */
    scan(chainId: number, address: string): Promise<SecurityResponse> {
        return apiFetch(this.base, `/api/v1/token/security/${chainId}/${address}`);
    }
}

/** Chains */
class ChainsModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/chains
     * All supported chains (optionally filtered by provider or type).
     */
    list(params?: {
        provider?: 'lifi' | 'dexscreener' | 'relay';
        type?: 'EVM' | 'Solana' | 'Cosmos' | 'TON' | 'TRON';
    }): Promise<ChainsResponse> {
        return apiFetch(this.base, '/api/v1/chains', undefined, {
            provider: params?.provider,
            type: params?.type,
        });
    }
}

/** Swap Route */
class RouteModule {
    constructor(private base: string) { }

    /**
     * POST /api/v1/route
     * Get the best swap route between two tokens across chains.
     */
    get(body: RouteRequest): Promise<RouteResponse> {
        return apiFetch(this.base, '/api/v1/route', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
}

/** Wallet Balances */
class WalletModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/wallet/balances
     * Token balances for a wallet address. Pass comma-separated `chains` to filter.
     */
    balances(params: {
        address: string;
        chains?: number[];
    }): Promise<WalletBalanceResponse> {
        return apiFetch(this.base, '/api/v1/wallet/balances', undefined, {
            address: params.address,
            chains: params.chains?.join(','),
        });
    }

    /**
     * GET /api/v1/wallet/transactions
     * Transaction history for a wallet.
     */
    transactions(params: {
        address: string;
        chains?: number[];
        chainId?: number;
        types?: string[];
        limit?: number;
        offset?: number;
        timeWindow?: '24h' | '7d' | '30d';
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/wallet/transactions', undefined, {
            address: params.address,
            chains: params.chains?.join(',') || (params.chainId ? String(params.chainId) : undefined),
            types: params.types?.join(','),
            limit: params.limit,
            offset: params.offset,
            timeWindow: params.timeWindow,
        } as any);
    }

    /**
     * POST /api/v1/wallet/register
     * Register or update a wallet address in the backend.
     */
    register(address: string, source: string): Promise<any> {
        return apiFetch(this.base, '/api/v1/wallet/register', {
            method: 'POST',
            body: JSON.stringify({ address, source }),
        });
    }

    /**
     * POST /api/v1/tiwi/transactions
     * Log a transaction performed via the app.
     */
    logTransaction(txData: {
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
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/tiwi/transactions', {
            method: 'POST',
            body: JSON.stringify(txData),
        });
    }
}

/** Staking Pools */
class StakingModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/staking-pools
     * Retrieve all staking pools (optionally filtered).
     */
    list(params?: {
        chainId?: number;
        tokenSymbol?: string;
        status?: 'active' | 'inactive' | 'archived';
    }): Promise<StakingPoolsResponse> {
        return apiFetch(this.base, '/api/v1/staking-pools', undefined, {
            chainId: params?.chainId,
            tokenSymbol: params?.tokenSymbol,
            status: params?.status,
        });
    }

    /**
     * GET /api/v1/user-stakes
     * Retrieve stakes for a specific wallet.
     */
    userStakes(params: {
        walletAddress: string;
        chainId?: number;
        poolId?: string;
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/user-stakes', undefined, {
            walletAddress: params.walletAddress,
            chainId: params.chainId,
            poolId: params.poolId,
        });
    }
}

/** Notifications */
class NotificationsModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/notifications
     * Retrieve notifications. Pass `userWallet` to get personalised unread counts.
     */
    list(params?: {
        status?: string;
        userWallet?: string;
        unreadOnly?: boolean;
    }): Promise<NotificationsResponse> {
        return apiFetch(this.base, '/api/v1/notifications', undefined, {
            status: params?.status,
            userWallet: params?.userWallet,
            unreadOnly: params?.unreadOnly,
        });
    }

    /**
     * POST /api/v1/notifications/mark-viewed
     * Mark a notification as viewed for a wallet.
     */
    markViewed(params: {
        notificationId: string;
        userWallet: string;
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/notifications/mark-viewed', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    // Push token registration is done directly against Supabase from the
    // mobile client (services/notificationService.ts). The Postgres trigger
    // handles fan-out, so no API endpoint is needed here.
}

/** FAQs */
class FaqsModule {
    constructor(private base: string) { }

    /** GET /api/v1/faqs */
    list(): Promise<FaqsResponse> {
        return apiFetch(this.base, '/api/v1/faqs');
    }
}

/** Tutorials */
class TutorialsModule {
    constructor(private base: string) { }

    /** GET /api/v1/tutorials */
    list(): Promise<TutorialsResponse> {
        return apiFetch(this.base, '/api/v1/tutorials');
    }
}

/** Adverts */
class AdvertsModule {
    constructor(private base: string) { }

    /** GET /api/v1/adverts */
    list(): Promise<AdvertsResponse> {
        return apiFetch(this.base, '/api/v1/adverts');
    }
}

/** NFTs */
class NftsModule {
    constructor(private base: string) { }

    /**
     * GET /api/v1/nft/wallet
     * List NFTs for a wallet.
     */
    list(params: { address: string; chainIds?: number[] }): Promise<{ nfts: any[]; total: number }> {
        return apiFetch(this.base, '/api/v1/nft/wallet', undefined, {
            address: params.address,
            chains: params.chainIds?.join(','),
        });
    }

    /**
     * GET /api/v1/nfts/{address}/{contractAddress}/{tokenId}
     * Get specific NFT details.
     */
    get(address: string, contractAddress: string, tokenId: string): Promise<any> {
        return apiFetch(this.base, `/api/v1/nfts/${address}/${contractAddress}/${tokenId}`);
    }
}

/** Referrals */
class ReferralsModule {
    constructor(private base: string) { }

    /** GET /api/v1/referrals */
    get(walletAddress: string): Promise<any> {
        return apiFetch(this.base, '/api/v1/referrals', undefined, { walletAddress });
    }
}

/** Charts (TradingView-compatible datafeed) */
class ChartsModule {
    constructor(private base: string) { }

    /** GET /api/v1/charts/config  – feed configuration */
    config(): Promise<any> {
        return apiFetch(this.base, '/api/v1/charts/config');
    }

    /** GET /api/v1/charts/symbols?symbol=BTCUSDT */
    symbols(symbol: string): Promise<any> {
        return apiFetch(this.base, '/api/v1/charts/symbols', undefined, { symbol });
    }

    /**
     * GET /api/v1/charts/history
     * OHLCV bars for a symbol.
     */
    history(params: {
        symbol: string;
        resolution: string;
        from: number;
        to: number;
        countback?: number;
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/charts/history', undefined, params as any);
    }

    /**
     * GET /api/v1/charts/token
     * Mobile-friendly chart with candles, points, summary stats, and metadata.
     */
    token(params: {
        baseToken: string;
        quoteToken?: string;
        chainId?: number;
        baseChainId?: number;
        quoteChainId?: number;
        resolution?: string;
        range?: string;
        from?: number;
        to?: number;
        countback?: number;
        filled?: boolean;
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/charts/token', undefined, {
            baseToken: params.baseToken,
            quoteToken: params.quoteToken || 'USD',
            chainId: params.chainId,
            baseChainId: params.baseChainId,
            quoteChainId: params.quoteChainId,
            resolution: params.resolution || '15',
            range: params.range || '1D',
            from: params.from,
            to: params.to,
            countback: params.countback,
            filled: params.filled,
        } as any);
    }
}

/** Live Status */
class LiveStatusModule {
    constructor(private base: string) { }

    /** GET /api/v1/live-status  – backend health & API status */
    get(): Promise<any> {
        return apiFetch(this.base, '/api/v1/live-status');
    }
}

/** Gasless Swap */
class GaslessSwapModule {
    constructor(private base: string) { }

    /** POST /api/v1/gasless-swap */
    execute(body: any): Promise<any> {
        return apiFetch(this.base, '/api/v1/gasless-swap', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
}

/** Jupiter (Solana) Swap */
class JupiterModule {
    constructor(private base: string) { }

    /** POST /api/v1/jupiter/swap */
    swap(body: any): Promise<any> {
        return apiFetch(this.base, '/api/v1/jupiter/swap', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
}

/** Token Spotlight */
class TokenSpotlightModule {
    constructor(private base: string) { }

    /** 
     * GET /api/v1/token-spotlight 
     * category: 'spotlight' | 'listing'
     */
    get(params?: { category?: 'spotlight' | 'listing'; activeOnly?: boolean }): Promise<any> {
        return apiFetch(this.base, '/api/v1/token-spotlight', undefined, {
            category: params?.category,
            activeOnly: params?.activeOnly ? 'true' : undefined
        });
    }
}

/** Bug Reports */
class BugReportsModule {
    constructor(private base: string) { }

    /** POST /api/v1/bug-reports */
    submit(body: {
        title?: string;
        description: string;
        userWallet?: string;
        walletAddress?: string;
        screenshot?: string;
        logFile?: string;
        deviceInfo?: any;
    }): Promise<any> {
        return apiFetch(this.base, '/api/v1/bug-reports', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
}

/** Translate */
class TranslateModule {
    constructor(private base: string) { }

    /** POST /api/v1/translate */
    translate(body: { text: string; targetLang: string }): Promise<any> {
        return apiFetch(this.base, '/api/v1/translate', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
}

// ─── Main client ──────────────────────────────────────────────────────────────

// ─── Main client ──────────────────────────────────────────────────────────────

/**
 * TiwiApiClient
 *
 * Instantiate once per app and reuse across screens.
 *
 * @example
 * ```ts
 * import { TiwiApiClient, TIWI_API_BASE_URL } from '@/lib/mobile/api-client';
 * export const api = new TiwiApiClient(TIWI_API_BASE_URL);
 * ```
 */
export class TiwiApiClient {
    public readonly tokens: TokensModule;
    public readonly market: MarketModule;
    public readonly tokenInfo: TokenInfoModule;
    public readonly security: SecurityModule;
    public readonly chains: ChainsModule;
    public readonly route: RouteModule;
    public readonly wallet: WalletModule;
    public readonly staking: StakingModule;
    public readonly notifications: NotificationsModule;
    public readonly faqs: FaqsModule;
    public readonly tutorials: TutorialsModule;
    public readonly adverts: AdvertsModule;
    public readonly referral: ReferralsModule;
    public readonly charts: ChartsModule;
    public readonly liveStatus: LiveStatusModule;
    public readonly gaslessSwap: GaslessSwapModule;
    public readonly jupiter: JupiterModule;
    public readonly nfts: NftsModule;
    public readonly tokenSpotlight: TokenSpotlightModule;
    public readonly bugReports: BugReportsModule;
    public readonly translate: TranslateModule;

    private readonly baseUrl: string;

    constructor(baseUrl: string = TIWI_API_BASE_URL) {
        console.log('[TiwiAPI] Initializing with base:', baseUrl);
        this.baseUrl = baseUrl;
        this.tokens = new TokensModule(baseUrl);
        this.market = new MarketModule(baseUrl);
        this.tokenInfo = new TokenInfoModule(baseUrl);
        this.security = new SecurityModule(baseUrl);
        this.chains = new ChainsModule(baseUrl);
        this.route = new RouteModule(baseUrl);
        this.wallet = new WalletModule(baseUrl);
        this.staking = new StakingModule(baseUrl);
        this.notifications = new NotificationsModule(baseUrl);
        this.faqs = new FaqsModule(baseUrl);
        this.tutorials = new TutorialsModule(baseUrl);
        this.adverts = new AdvertsModule(baseUrl);
        this.referral = new ReferralsModule(baseUrl);
        this.charts = new ChartsModule(baseUrl);
        this.liveStatus = new LiveStatusModule(baseUrl);
        this.gaslessSwap = new GaslessSwapModule(baseUrl);
        this.jupiter = new JupiterModule(baseUrl);
        this.nfts = new NftsModule(baseUrl);
        this.tokenSpotlight = new TokenSpotlightModule(baseUrl);
        this.bugReports = new BugReportsModule(baseUrl);
        this.translate = new TranslateModule(baseUrl);
    }

    /**
     * POST /api/v1/upload
     * Upload a file (e.g. screenshot or logs).
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
}

/** Shared singleton — import this in your mobile screens */
export const api = new TiwiApiClient(TIWI_API_BASE_URL);

// Re-export modules just in case manual instantiation is needed
export {
    TokensModule, MarketModule, TokenInfoModule, SecurityModule,
    ChainsModule, RouteModule, WalletModule, StakingModule,
    NotificationsModule, NftsModule
};
