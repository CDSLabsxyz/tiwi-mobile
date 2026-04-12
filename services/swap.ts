
import { api, RouteRequest } from '@/lib/mobile/api-client';
import { parseUnits } from 'viem';
import { relayService } from './relayService';
import { SwapQuote, TokenMinimal } from './swap/types';
import { unifiedSwapManager } from './swap/UnifiedSwapManager';

export * from './swap/types';

const JUPITER_API = 'https://quote-api.jup.ag/v6';

/**
 * Fetch quote and swap transaction directly from Jupiter API
 */
async function fetchJupiterQuote(
    fromAmount: string,
    fromToken: TokenMinimal,
    toToken: TokenMinimal,
    userAddress: string,
    slippage: number
): Promise<SwapQuote | null> {
    const inputMint = fromToken.address;
    const outputMint = toToken.address;
    const amountInLamports = parseUnits(fromAmount, fromToken.decimals).toString();
    const slippageBps = Math.round(slippage * 100); // 0.5% -> 50 bps

    console.log(`[Jupiter] Fetching quote: ${inputMint} -> ${outputMint}, amount: ${amountInLamports}`);

    // 1. Get quote
    const quoteRes = await fetch(
        `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInLamports}&slippageBps=${slippageBps}`
    );
    if (!quoteRes.ok) {
        const err = await quoteRes.text();
        throw new Error(`Jupiter quote failed: ${err}`);
    }
    const quoteData = await quoteRes.json();

    if (!quoteData || !quoteData.outAmount) {
        throw new Error('Jupiter returned no quote');
    }

    console.log(`[Jupiter] Quote received: outAmount=${quoteData.outAmount}`);

    // 2. Get swap transaction
    const swapRes = await fetch(`${JUPITER_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            quoteResponse: quoteData,
            userPublicKey: userAddress,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
        }),
    });
    if (!swapRes.ok) {
        const err = await swapRes.text();
        throw new Error(`Jupiter swap tx failed: ${err}`);
    }
    const swapData = await swapRes.json();

    if (!swapData.swapTransaction) {
        throw new Error('Jupiter did not return swap transaction');
    }

    console.log(`[Jupiter] Swap transaction received (${swapData.swapTransaction.length} chars)`);

    const outAmountFormatted = (Number(quoteData.outAmount) / Math.pow(10, toToken.decimals)).toString();
    const priceImpact = quoteData.priceImpactPct || '0';

    return {
        toAmount: outAmountFormatted,
        fiatAmount: '0',
        slippage,
        gasEstimate: '0',
        gasFee: '$0.00',
        twcFee: '',
        source: ['Jupiter'],
        router: 'jupiter',
        raw: {
            ...quoteData,
            swapTransaction: swapData.swapTransaction,
        },
        quoteId: quoteData.contextSlot?.toString(),
    };
}

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

    // Solana chains — skip Relay (not supported for execution), use Tiwi Routing Engine (Jupiter)
    const SOLANA_CHAIN_IDS = [7565164, 1399811149];
    const isSolanaSwap = SOLANA_CHAIN_IDS.includes(Number(fromToken.chainId)) || SOLANA_CHAIN_IDS.includes(Number(toToken.chainId));

    if (!isSolanaSwap) {
        try {
            console.log(`[SwapService] Checking Relay Protocol first...`);
            const relayQuote = await relayService.fetchRelayQuote(fromAmount, fromToken, toToken, fromAddress, recipient, slippage);

            if (relayQuote) {
                console.log(`[SwapService] Using Relay Protocol quote for ${fromToken.symbol} -> ${toToken.symbol}`);
                return relayQuote;
            }
        } catch (relayError) {
            console.warn(`[SwapService] Relay quote fetch failed or unavailable, falling back to Tiwi Routing Engine:`, relayError);
        }
    } else {
        console.log(`[SwapService] Solana swap detected — using Jupiter direct`);

        // Direct Jupiter quote + swap transaction
        try {
            const jupiterQuote = await fetchJupiterQuote(fromAmount, fromToken, toToken, fromAddress, slippage);
            if (jupiterQuote) return jupiterQuote;
        } catch (jupError: any) {
            console.warn('[SwapService] Jupiter direct failed:', jupError.message);
        }
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

        // If the backend says "relay" but this is a same-chain swap, Relay won't work
        // (it's a cross-chain protocol). Override to 'tiwi' and extract the transaction
        // from the Relay steps format so TiwiExecutor can execute it directly.
        let router = response.route.router;
        let transactionRequest = response.transactionRequest;
        const isSameChain = Number(fromToken.chainId) === Number(toToken.chainId);

        if (router === 'relay' && isSameChain) {
            console.log(`[SwapService] Same-chain swap — overriding router from 'relay' to 'tiwi'`);
            router = 'tiwi';

            // Extract transaction data from Relay steps if no transactionRequest exists
            if (!transactionRequest) {
                const steps = response.route.raw?.steps || [];
                for (const step of steps) {
                    for (const item of step.items || []) {
                        if (item.data?.to && item.data?.data) {
                            transactionRequest = {
                                to: item.data.to,
                                data: item.data.data,
                                value: item.data.value || '0',
                                chainId: item.data.chainId || fromToken.chainId,
                            };
                            console.log(`[SwapService] Extracted transactionRequest from Relay steps: to=${transactionRequest.to}`);
                            break;
                        }
                    }
                    if (transactionRequest) break;
                }
            }
        }

        // Map RouteResponse to SwapQuote (UI Compatibility)
        return {
            toAmount: response.route.toToken?.amount || '0',
            fiatAmount: response.route.toToken?.amountUSD || '0',
            slippage: slippage,
            gasEstimate: response.route.fees?.gasUSD || '0',
            gasFee: response.route.fees?.gasUSD ? `$${response.route.fees.gasUSD}` : '0',
            twcFee: '',
            source: [router ? router.charAt(0).toUpperCase() + router.slice(1) : 'Tiwi Router'],
            router: router,
            transactionRequest: transactionRequest,
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
