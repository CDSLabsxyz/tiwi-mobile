
import { acrossService } from './acrossService';
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
        // HARDCODED: Remove Tiwi backend dependency, use Across SDK directly
        const acrossQuote = await acrossService.fetchAcrossQuote(
            fromAmount,
            fromToken,
            toToken,
            fromAddress,
            recipient,
            slippage
        );

        if (acrossQuote) {
            console.log("🚀 ~ fetchSwapQuote ~ acrossQuote:", acrossQuote)
            return acrossQuote;
        }

        throw new Error('Across failed to provide a quote');
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
