import { apiClient, FetchRouteParams } from './apiClient';

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

        const response = await apiClient.fetchRoute(params);
        const route = response.route;

        // Calculate rate
        const rate = parseFloat(route.toToken.amount) / parseFloat(route.fromToken.amount);

        // Extract USD values
        const toFiat = route.toToken.amountUSD ? `$${parseFloat(route.toToken.amountUSD).toFixed(2)}` : `$${(parseFloat(route.toToken.amount) * 1).toFixed(2)}`;
        const gasFee = route.fees?.gasUSD ? `$${parseFloat(route.fees.gasUSD).toFixed(2)}` : '0.001%';

        return {
            toAmount: route.toToken.amount,
            fiatAmount: toFiat,
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
    fromAddress: string
): Promise<{ txHash: string }> {
    // In a real app, this would trigger the wallet signature
    // For now, we simulate the delay and log it
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const txHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    return { txHash };
}
