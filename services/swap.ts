
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

    // Relay is a CROSS-CHAIN protocol — it must NOT be used for same-chain swaps because
    // it can't handle fee-on-transfer tokens (e.g., WKC on BSC) and ends up taking
    // tokens without completing the swap. For same-chain, go straight to native DEX routing.
    const isSameChain = Number(fromToken.chainId) === Number(toToken.chainId);

    const fetchTiwiRouteQuote = async (): Promise<SwapQuote> => {
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
        // (it's a cross-chain protocol that doesn't handle fee-on-transfer tokens).
        // Force routing through DexExecutor which uses the FoT-compatible PancakeSwap router.
        let router = response.route.router;
        let transactionRequest = response.transactionRequest;
        const sameChainResp = Number(fromToken.chainId) === Number(toToken.chainId);

        if (router === 'relay' && sameChainResp) {
            console.log(`[SwapService] Same-chain swap — forcing DexExecutor (discarding Relay tx)`);
            router = 'dex';
            transactionRequest = undefined;
        }

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
    };

    if (!isSolanaSwap && !isSameChain) {
        // Cross-chain: race Relay against the Tiwi Routing Engine. First successful
        // quote wins — historically these were called serially and a slow/timed-out
        // Relay request doubled the user-perceived quote time.
        console.log(`[SwapService] Cross-chain swap — racing Relay vs Tiwi Routing Engine`);
        const relayPromise = relayService
            .fetchRelayQuote(fromAmount, fromToken, toToken, fromAddress, recipient, slippage)
            .then((q) => {
                if (!q) throw new Error('Relay returned no quote');
                return q;
            });
        try {
            const winner = await Promise.any([relayPromise, fetchTiwiRouteQuote()]);
            console.log(`[SwapService] Cross-chain quote winner: ${winner.router || winner.source?.[0]}`);
            return winner;
        } catch (err: any) {
            // Both providers failed
            console.error('[SwapService] Both Relay and Tiwi Routing Engine failed:', err);
            throw new Error('No swap route found');
        }
    } else if (!isSolanaSwap && isSameChain) {
        console.log(`[SwapService] Same-chain swap (${fromToken.symbol} -> ${toToken.symbol} on chain ${fromToken.chainId}) — using native DEX routing`);
        try {
            return await fetchTiwiRouteQuote();
        } catch (error: any) {
            console.error('[SwapService] fetchSwapQuote failed:', error);
            throw error;
        }
    } else {
        console.log(`[SwapService] Solana swap detected — using Jupiter direct`);
        try {
            const jupiterQuote = await fetchJupiterQuote(fromAmount, fromToken, toToken, fromAddress, slippage);
            if (jupiterQuote) return jupiterQuote;
        } catch (jupError: any) {
            console.warn('[SwapService] Jupiter direct failed:', jupError.message);
        }
        try {
            return await fetchTiwiRouteQuote();
        } catch (error: any) {
            console.error('[SwapService] fetchSwapQuote failed:', error);
            throw error;
        }
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
