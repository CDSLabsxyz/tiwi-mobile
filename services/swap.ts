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

const TOKEN_PRICES: Record<string, number> = {
    twc: 1.0,
    usdc: 1.0,
    tether: 1.0,
    bnb: 600.0,
    eth: 2700.0,
};

const EXCHANGE_RATES: Record<string, Record<string, number>> = {
    twc: { usdc: 0.95, tether: 0.94, bnb: 0.00167, eth: 0.00037 },
    usdc: { twc: 1.05, tether: 0.999, bnb: 0.00167, eth: 0.00037 },
    tether: { twc: 1.06, usdc: 1.001, bnb: 0.00167, eth: 0.00037 },
    bnb: { twc: 600.0, usdc: 600.0, tether: 600.0, eth: 0.22 },
    eth: { twc: 2700.0, usdc: 2700.0, bnb: 4.5, tether: 2700.0 },
};

export async function fetchSwapQuote(
    fromAmount: string,
    fromTokenId: string,
    toTokenId: string
): Promise<SwapQuote> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
    }

    const fromId = fromTokenId.toLowerCase();
    const toId = toTokenId.toLowerCase();

    let rate: number;
    if (fromId === toId) {
        rate = 1.0;
    } else if (EXCHANGE_RATES[fromId] && EXCHANGE_RATES[fromId][toId]) {
        rate = EXCHANGE_RATES[fromId][toId];
    } else {
        const fromPrice = TOKEN_PRICES[fromId] || 1.0;
        const toPrice = TOKEN_PRICES[toId] || 1.0;
        rate = fromPrice / toPrice;
    }

    const toAmountValue = amount * rate;
    let toAmount = toAmountValue > 1 ? toAmountValue.toFixed(4) : toAmountValue.toFixed(6);
    toAmount = parseFloat(toAmount).toString();

    const toPrice = TOKEN_PRICES[toId] || 1.0;
    const fiatValue = toAmountValue * toPrice;
    const fiatAmount = `$${fiatValue.toFixed(2)}`;

    return {
        toAmount,
        fiatAmount,
        rate,
        slippage: 0.5,
        gasEstimate: '0.001',
        gasFee: '0.001%',
        twcFee: '0.40%',
        source: ['Best', 'TWC'],
    };
}

export async function executeSwap(
    fromAmount: string,
    fromTokenId: string,
    toTokenId: string
): Promise<{ txHash: string }> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const txHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;
    return { txHash };
}
