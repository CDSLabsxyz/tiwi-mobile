
import { api, RouteRequest } from '@/lib/mobile/api-client';
import { SwapQuote, TokenMinimal } from './swap/types';
import { unifiedSwapManager } from './swap/UnifiedSwapManager';

export * from './swap/types';

/**
 * Swap service - handles swap-related API calls using the new Routing Engine
 */

export async function fetchSwapQuote(
    fromAmount: string,
    fromToken: TokenMinimal,
    toToken: TokenMinimal,
    fromAddress: string,
    recipient: string,
    slippage: number = 0.5
): Promise<SwapQuote> {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
        throw new Error('Invalid amount');
    }

    try {
        console.log(`[SwapService] Using Tiwi Routing Engine for ${fromToken.symbol} -> ${toToken.symbol}`);

        const routeReq: RouteRequest = {
            fromToken: {
                chainId: fromToken.chainId,
                address: fromToken.address,
                symbol: fromToken.symbol,
                decimals: fromToken.decimals,
            },
            toToken: {
                chainId: toToken.chainId,
                address: toToken.address,
                symbol: toToken.symbol,
                decimals: toToken.decimals,
            },
            fromAmount,
            fromAddress,
            recipient,
            slippage,
        };

        const response: any = await api.route.get(routeReq);

        if (!response || !response.route) {
            throw new Error('No swap route found');
        }

        // Map RouteResponse to SwapQuote (UI Compatibility)
        return {
            toAmount: response.route.toToken?.amount || '0',
            fiatAmount: response.route.toToken?.amountUSD || '0',
            slippage: slippage,
            gasEstimate: response.route.fees?.gasUSD || '0',
            gasFee: response.route.fees?.gasUSD ? `$${response.route.fees.gasUSD}` : '0',
            twcFee: '',
            source: [response.route.router ? response.route.router.charAt(0).toUpperCase() + response.route.router.slice(1) : 'Tiwi Router'],
            router: response.route.router,
            transactionRequest: response.transactionRequest,
            raw: response.route.raw,
            quoteId: response.route.routeId,
        };
    } catch (error: any) {
        console.error('[SwapService] fetchSwapQuote failed:', error);
        throw error;
    }
}

export async function executeSwap(
    fromAmount: string,
    fromToken: TokenMinimal,
    toToken: TokenMinimal,
    fromAddress: string,
    recipientAddress: string,
    quote: SwapQuote
): Promise<{ txHash: string }> {
    const result = await unifiedSwapManager.execute({
        fromAmount,
        fromToken,
        toToken,
        fromAddress,
        recipientAddress,
        quote,
    });

    if (result.success && result.txHash) {
        return { txHash: result.txHash };
    } else {
        throw new Error(result.error || 'Swap execution failed');
    }
}
