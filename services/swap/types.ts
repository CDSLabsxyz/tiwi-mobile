
export interface TokenMinimal {
    address: string;
    symbol: string;
    decimals: number;
    chainId: number;
    logoURI?: string;
    priceUSD?: string;
    /**
     * Pair liquidity in USD, straight from the token list.
     *
     * Sent to /api/v1/route as `liquidityUSD`. It is NOT cosmetic: without it
     * the backend's auto-slippage service has to look the pair up on
     * DexScreener on every single quote, which measured 2–16s versus ~0.6s when
     * the client supplies it. Web has always sent it; mobile didn't, and that
     * was the whole quote-speed gap.
     */
    liquidity?: number;
}

export interface SwapQuote {
    toAmount: string;
    fiatAmount: string;
    slippage: number;
    gasEstimate: string;
    gasFee: string;
    twcFee: string;
    source: string[];
    txTo?: string;
    txData?: string;
    txValue?: string;
    fromAmountUSD?: string;
    toAmountUSD?: string;
    raw?: any;
    router?: string;
    quoteId?: string;
    transactionRequest?: any;
    /**
     * The backend's normalized RouterRoute, kept verbatim. This is what the
     * swap engine (services/swap/core) actually executes - every field above is
     * a display-only projection of it. Always present: quotes come from one
     * source (/api/v1/route), exactly like the web app.
     */
    route: any;
    /** Runner-up routes, used for the executable-route fallback. */
    alternatives?: any[];
    /** Quote expiry (unix seconds, as the backend emits it). */
    expiresAt?: number;
}

export interface ExecuteSwapParams {
    fromAmount: string;
    fromToken: TokenMinimal;
    toToken: TokenMinimal;
    fromAddress: string;
    recipientAddress: string;
    quote: SwapQuote;
}

export interface SwapExecutionResult {
    success: boolean;
    txHash?: string;
    error?: string;
}
