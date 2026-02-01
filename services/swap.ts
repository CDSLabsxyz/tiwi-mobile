import { parseEther } from 'viem';
import { apiClient, FetchRouteParams } from './apiClient';
import { signerController } from './signer/SignerController';

/**
 * Swap service - handles swap-related API calls
 */

export interface SwapQuote {
    toAmount: string;
    fiatAmount: string;
    rate: number;
    slippage: number;
    gasEstimate: string;
    gasFee: string;
    twcFee: string;
    source: string[];
    // Execution Data (added for Local Signing)
    txTo?: string;
    txData?: string;
    txValue?: string;
    fromAmountUSD?: string;
    toAmountUSD?: string;
}

interface TokenMinimal {
    address: string;
    chainId: number;
    symbol: string;
    decimals: number;
}

export async function fetchSwapQuote(
    fromAmount: string,
    fromToken: TokenMinimal,
    toToken: TokenMinimal,
    fromAddress?: string
): Promise<SwapQuote> {

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
    }

    try {
        const params: FetchRouteParams = {
            fromToken: {
                address: fromToken.address,
                chainId: fromToken.chainId,
                symbol: fromToken.symbol,
                decimals: fromToken.decimals,
            },
            toToken: {
                address: toToken.address,
                chainId: toToken.chainId,
                symbol: toToken.symbol,
                decimals: toToken.decimals,
            },
            fromAmount: fromAmount,
            fromAddress: fromAddress,
            order: 'RECOMMENDED',
        };
        console.log("🚀 ~ fetchSwapQuote ~ params:", params)

        const response = await apiClient.fetchRoute(params);
        const route = response.route;
        console.log("🚀 ~ fetchSwapQuote ~ route:", route)

        // Calculate rate
        const rate = parseFloat(route.toToken.amount) / parseFloat(route.fromToken.amount);

        // Extract USD values
        const toFiat = route.toToken.amountUSD ? route.toToken.amountUSD : (parseFloat(route.toToken.amount) * 1).toString();
        const fromFiat = route.fromToken.amountUSD ? route.fromToken.amountUSD : (parseFloat(route.fromToken.amount) * 1).toString();
        const gasFee = route.fees?.gasUSD ? `$${parseFloat(route.fees.gasUSD).toFixed(2)}` : '0.001%';

        return {
            toAmount: route.toToken.amount,
            fiatAmount: toFiat, // Keeping for backward compatibility but using toAmountUSD preferred
            fromAmountUSD: fromFiat,
            toAmountUSD: toFiat,
            rate,
            slippage: route.slippage ? parseFloat(route.slippage) : 0.5,
            gasEstimate: route.fees?.gas || '0.001',
            gasFee: gasFee,
            twcFee: '0.40%',
            source: [route.router || 'Best', 'Tiwi Router'],
        };
    } catch (error) {
        console.error('[SwapService] fetchSwapQuote failed, using fallback:', error);
        // Fallback to simple calculation if API fails
        return {
            toAmount: (amount * 1).toString(),
            fiatAmount: `$${(amount * 1).toFixed(2)}`,
            rate: 1,
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
    quote: SwapQuote // We pass the quote which should contain the tx data
): Promise<{ txHash: string }> {
    try {
        // 1. Prepare Transaction Request
        const chainFamily = fromToken.address.startsWith('0x') || [1, 56, 137, 8453, 42161].includes(fromToken.chainId)
            ? 'evm'
            : 'solana';

        const txRequest = {
            chainFamily: chainFamily as any,
            to: quote.txTo || fromToken.address,
            value: quote.txValue || (fromToken.address === '0x0000000000000000000000000000000000000000' ? parseEther(fromAmount).toString() : '0'),
            data: quote.txData || '0x',
            chainId: fromToken.chainId,
        };

        // 2. Execute via the Unified Signer Controller
        const result = await signerController.executeTransaction(txRequest, fromAddress);

        if (result.status === 'success') {
            return { txHash: result.hash };
        } else {
            throw new Error(result.error || 'Transaction failed');
        }
    } catch (error: any) {
        console.error('[SwapService] executeSwap failed', error);
        throw error;
    }
}
