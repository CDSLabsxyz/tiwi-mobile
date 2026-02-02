import { formatUnits, parseUnits } from 'viem';
import { apiClient } from './apiClient';
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
    recipient: string
): Promise<SwapQuote> {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
        throw new Error('Invalid amount');
    }

    try {
        const params = {
            fromChainId: fromToken.chainId,
            toChainId: toToken.chainId,
            fromToken,
            toToken,
            fromAmount,
            fromAddress,
            recipient,
            slippage: 0.5
        };

        const response = await apiClient.fetchRoute(params);
        console.log("🚀 ~ fetchSwapQuote ~ response:", response)
        const route = response.route;


        // Extract USD values
        const fromFiat = route.fromToken.amountUSD || '0';
        const toFiat = route.toToken.amountUSD || '0';
        const gasFee = route.fees?.gasUSD ? `$${parseFloat(route.fees.gasUSD).toFixed(2)}` : '0.001%';

        // Extract execution data
        const txTo = route.transactionRequest?.to || route.raw?.routerAddress || route.toToken.address;
        const txData = route.transactionRequest?.data || route.transactionData || '0x';
        const txValue = route.transactionRequest?.value || '0';

        // Fix: Use raw.amountOut if toToken.amount has a decimal point, as BigInt() fails on decimals
        let toAmountFormatted = route.toToken.amount;
        if (route.toToken.amount.includes('.')) {
            // It's already human readable
            toAmountFormatted = route.toToken.amount;
        } else {
            // It's atomic/integer, format it
            try {
                toAmountFormatted = formatUnits(BigInt(route.toToken.amount), toToken.decimals);
            } catch (e) {
                // If BigInt still fails (e.g. empty string), use a fallback
                toAmountFormatted = '0';
            }
        }

        return {
            toAmount: toAmountFormatted,
            fiatAmount: toFiat,
            fromAmountUSD: fromFiat,
            toAmountUSD: toFiat,
            slippage: route.slippage ? parseFloat(route.slippage) : 0.5,
            gasEstimate: route.fees?.gas || '0.001',
            gasFee: gasFee,
            twcFee: '0.40%',
            source: [route.router || 'Best', 'Tiwi Router'],
            txTo,
            txData,
            txValue,
            raw: route.raw, // Preserve raw for client-side encoding if needed
            router: route.router, // Store router for the executor
        };
    } catch (error) {
        console.error('[SwapService] fetchSwapQuote failed, using fallback:', error);
        return {
            toAmount: fromAmount,
            fiatAmount: '0',
            slippage: 0.5,
            gasEstimate: '0.001',
            gasFee: '0.001%',
            twcFee: '0.40%',
            source: ['Fallback', 'Tiwi'],
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
