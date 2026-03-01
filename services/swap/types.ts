
export interface TokenMinimal {
    address: string;
    symbol: string;
    decimals: number;
    chainId: number;
    logoURI?: string;
    priceUSD?: string;
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
