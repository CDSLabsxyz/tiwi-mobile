
import { acrossService } from './acrossService';
import { relayService } from './relayService';
import { SwapQuote, TokenMinimal } from './swap/types';
import { unifiedSwapManager } from './swap/UnifiedSwapManager';

export * from './swap/types';

/**
 * Swap service - handles swap-related API calls
 */

export async function fetchSwapQuote(
    fromAmount: string,
    fromToken: TokenMinimal,
    toToken: TokenMinimal,
    fromAddress: string,
    recipient: string,
    slippage?: number
): Promise<SwapQuote> {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
        throw new Error('Invalid amount');
    }

    try {
    // 1. Fetch from best sources in parallel for speed
    console.log(`[SwapService] Parallel quoting for ${fromToken.symbol} -> ${toToken.symbol}`);
    const results = await Promise.allSettled([
        acrossService.fetchAcrossQuote(fromAmount, fromToken, toToken, fromAddress, recipient, slippage),
        relayService.fetchRelayQuote(fromAmount, fromToken, toToken, fromAddress, recipient, slippage)
    ]);

    const acrossQuote = (results[0].status === 'fulfilled' && results[0].value?.router !== 'error') ? results[0].value : null;
    const relayQuote = (results[1].status === 'fulfilled' && results[1].value?.router !== 'error') ? results[1].value : null;

    // 2. Selection logic: 
    // Always prefer Across as Priority 1 (best for aggregators/taxes)
    // Fallback to Relay for others.
    if (acrossQuote) {
        console.log("[SwapService] Selecting Across Quote (Primary Route)");
        return acrossQuote;
    }
    if (relayQuote) {
        console.log("[SwapService] Selecting Relay Quote (Secondary Route)");
        return relayQuote;
    }

    throw new Error('No swap route found for this pair. Try a different amount or asset.');
    } catch (error) {
        console.error('[SwapService] fetchSwapQuote failed:', error);
        return {
            toAmount: fromAmount,
            fiatAmount: '0',
            slippage: 0.5,
            gasEstimate: '0.001',
            gasFee: '0',
            twcFee: '0.00%',
            source: ['Error', 'Across'],
            router: 'error',
        };
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
