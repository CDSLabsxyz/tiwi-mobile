/**
 * Router Types
 * 
 * Core types for the swap routing system.
 * These types define the contract between routers and the route service.
 */

// ============================================================================
// Router Parameters (Normalized)
// ============================================================================

/**
 * Normalized router parameters (after transformation from canonical format)
 * These are router-specific and ready to be passed to router APIs
 */
export interface RouterParams {
  fromChainId: number | string;        // Provider-specific chain ID
  fromToken: string;                   // Provider-specific token identifier
  fromAmount: string;                  // Amount in smallest unit
  fromDecimals: number;                // Token decimals (from request or fetched)
  toChainId: number | string;
  toToken: string;
  toDecimals: number;                  // Token decimals (from request or fetched)
  recipient?: string;                  // Provider-specific address format (taker for Jupiter)
  fromAddress?: string;               // User's wallet address (optional, for LiFi getQuote)
  slippage?: number;                   // Provider-specific slippage format
  slippageMode?: 'fixed' | 'auto';    // Slippage mode (for Jupiter RTSE)
  order?: string;                      // Provider-specific order preference
  gasTokenType?: number;               // Gas token type choice (for BSC relayer tax tiers)
  poolAddress?: string;                // Deep-link: specific TIWI liquidity-hub pair to swap through
  preferredRouter?: string;            // Deep-link: force this router (e.g. 'tiwi-pool') over best-price selection
}

// ============================================================================
// Router Route (Normalized Response)
// ============================================================================

/**
 * Normalized router response
 * All routers must return this format after normalization
 */
export interface RouterRoute {
  // Route identification
  router: string;                      // Router name (e.g., 'lifi', 'squid')
  routeId: string;                     // Unique route identifier

  // Token information
  fromToken: {
    chainId: number;                   // Canonical chain ID
    address: string;                    // Canonical token address
    symbol: string;                    // Token symbol
    amount: string;                    // Input amount (human-readable)
    amountUSD?: string;                 // Input amount in USD (from route or calculated)
    decimals: number;                  // Token decimals
  };
  toToken: {
    chainId: number;
    address: string;
    symbol: string;
    amount: string;                    // Output amount (human-readable)
    amountUSD?: string;                 // Output amount in USD (from route or calculated)
    decimals: number;
  };

  // Quote information
  exchangeRate: string;                // e.g., "1.5" (1 USDC = 1.5 USDT)
  priceImpact: string;                 // e.g., "0.5" (0.5%)
  slippage: string;                    // Applied slippage (e.g., "0.5")

  // Cost information
  fees: {
    protocol: string;                  // Protocol fee in USD (from router)
    gas: string;                       // Gas estimate (native token)
    gasUSD: string;                    // Gas estimate in USD
    tiwiProtocolFeeUSD?: string;       // Tiwi protocol fee (0.25% of fromAmountUSD)
    total: string;                     // Total fees in USD (includes Tiwi fee)
    // How the Tiwi fee is collected for this route:
    //  - 'inline'   → aggregator skims it inside the swap tx (no separate signature)
    //  - 'separate' → executor sends a standalone tax transfer (legacy default)
    // Undefined is treated as 'separate' by executors.
    taxMode?: 'inline' | 'separate';
    taxBps?: number;                   // Fee in basis points (when taxMode === 'inline')
    taxRecipient?: string;             // Revenue wallet that receives the inline fee
    jupiterFeeInfo?: {                 // Jupiter-specific fee breakdown (for display)
      jupiterFeeBps: number;           // Jupiter's default fee in basis points
      tiwiFeeBps: number;              // Tiwi protocol fee in basis points
      feeMint: string;                  // Token mint fees are collected in
    };
  };

  // Route steps
  steps: RouteStep[];

  // Execution metadata
  estimatedTime: number;               // Estimated time in seconds
  expiresAt: number;                  // Quote expiration timestamp (Unix timestamp)
  transactionData?: string;           // Encoded transaction (if available)

  // Raw router response (for debugging)
  raw?: any;                           // Original router response
}

export interface RouteStep {
  type: 'swap' | 'bridge' | 'wrap' | 'unwrap';
  chainId: number;                     // Canonical chain ID
  fromToken: {
    address: string;
    amount: string;
    symbol?: string;
    decimals?: number;
  };
  toToken: {
    address: string;
    amount: string;
    symbol?: string;
    decimals?: number;
  };
  protocol?: string;                   // e.g., "Uniswap V3", "Stargate"
  description?: string;                // Human-readable step description
  dexId?: string;                      // Registry dexId (e.g. 'uniswap-v3', 'pancakeswap') for execution
  feeTier?: number;                    // V3 pool fee tier (e.g. 500) - required to execute a V3 hop
  routerAddress?: string;              // On-chain DEX router for executing this hop (from dex-registry)
}

// ============================================================================
// Route Request (Canonical)
// ============================================================================

/**
 * Canonical route request format (what frontend sends)
 */
export interface RouteRequest {
  // Token information (canonical format)
  fromToken: {
    chainId: number;                   // Canonical chain ID
    address: string;                     // Token address
    symbol?: string;                    // Optional: for validation
    decimals: number | undefined;       // From token data (undefined means unknown, will be fetched)
  };
  toToken: {
    chainId: number;
    address: string;
    symbol?: string;
    decimals: number | undefined;       // From token data (undefined means unknown, will be fetched)
  };

  // Amount (exactly one of fromAmount or toAmount must be provided)
  fromAmount?: string;                   // Human-readable amount (e.g., "100.5")
  toAmount?: string;                     // Human-readable output amount (for reverse routing)

  // Optional parameters
  slippage?: number;                    // Slippage tolerance (0-100, default: 0.5)
  slippageMode?: 'fixed' | 'auto';     // Fixed slippage or auto-adjust (default: 'fixed')
  recipient?: string;                   // Recipient address (optional, for cross-chain)
  fromAddress?: string;                // User's wallet address (optional, for LiFi getQuote - improves quote accuracy)
  order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST';  // Route preference (default: 'RECOMMENDED')
  liquidityUSD?: number;                // Token pair liquidity in USD (from frontend, optional - used for auto slippage)
  gasTokenType?: number;                // Gas token type choice (for BSC relayer tax tiers)

  // Deep-link "swap through this liquidity pool" (from a TIWI pool page's Swap button).
  // When preferredRouter === 'tiwi-pool' and poolAddress is set, the route service forces
  // the swap through that specific TiwiLiquidityPair (falling back to normal aggregator
  // routing only if the pool can't serve the pair).
  poolAddress?: string;                 // TiwiLiquidityPair contract address to swap through
  preferredRouter?: string;             // e.g. 'tiwi-pool' - force this router over best-price
}

// ============================================================================
// Route Response (Unified)
// ============================================================================

/**
 * Unified route response (what frontend receives)
 */
export interface RouteResponse {
  route: RouterRoute;                  // Best route
  alternatives?: RouterRoute[];        // Alternative routes (if available)
  timestamp: number;                   // Response timestamp
  expiresAt: number;                   // Quote expiration timestamp
}

// ============================================================================
// Router Error
// ============================================================================

/**
 * Router error with normalized and router-specific information
 */
export interface RouterError {
  // Normalized error (for frontend)
  message: string;                     // User-friendly error message
  code: string;                        // Error code (e.g., 'NO_ROUTE', 'UNSUPPORTED_PAIR')

  // Router-specific details (for backend debugging)
  router: string;                      // Router name
  routerError?: any;                   // Original router error
  routerErrorCode?: string;            // Router-specific error code
  routerErrorMessage?: string;         // Router-specific error message
}

