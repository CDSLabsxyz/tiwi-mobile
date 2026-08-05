/**
 * Swap service — a direct port of the web app's quote + execution pipeline.
 *
 * `fetchSwapQuote` mirrors `tiwi-user-app/hooks/useSwapQuote.ts` and
 * `executeSwap` mirrors `tiwi-user-app/hooks/useSwapExecution.ts`. Behaviour is
 * intentionally identical, so keep them in sync — the differences that used to
 * exist here all produced worse routes on mobile than on web:
 *
 *   • Quotes came from THREE sources (a Relay-vs-backend race, Jupiter direct,
 *     Skip direct) instead of one. Only the backend route carries fee mode,
 *     per-step dexIds/router addresses and expiry, and only it considers all
 *     ~30 routers — so mobile silently skipped better routes and lost the
 *     inline-fee signal.
 *   • Same-chain quotes were rewritten to `router: 'dex'` client-side, which
 *     threw away the backend's chosen router.
 *   • Cross-chain routes weren't checked for a one-signature aggregator, so a
 *     mobile user could get a multi-signature route where web gets one.
 *   • Routes weren't checked against `swapExecutor.canExecute`, so an
 *     unexecutable winner was served instead of an executable alternative.
 */

import { api, RouteRequest } from '@/lib/mobile/api-client';
import { swapExecutor } from '@/services/swap/core';
import type { RouterRoute } from '@/services/swap/core/router-types';
import type { SwapExecutionStatus } from '@/services/swap/core/types';
import { GasTokenType } from '@/services/swap/core/config/tax-config';
import { getCanonicalChain } from '@/services/swap/core/registry/chains';
import { isAddressChainCompatible } from '@/services/swap/core/utils/wallet-display';
import { useSwapStore } from '@/store/swapStore';
import { SwapQuote, TokenMinimal } from './swap/types';
import { unifiedSwapManager } from './swap/UnifiedSwapManager';

export * from './swap/types';

/**
 * The BSC relayer / gas-token tiering (TWC/BNB/Other) only applies to swaps that
 * stay entirely on BSC. When a BSC token is paired with an off-chain token the
 * relayer never runs, so the tiered tax falls back to the standard rate.
 * (Mirrors `isBscOnlySwap` in useSwapQuote.)
 */
const BSC_CHAIN_IDS = [56, 97];
const isBscOnlySwap = (from?: TokenMinimal | null, to?: TokenMinimal | null): boolean =>
    !!from?.chainId &&
    !!to?.chainId &&
    BSC_CHAIN_IDS.includes(Number(from.chainId)) &&
    BSC_CHAIN_IDS.includes(Number(to.chainId));

/**
 * Cross-chain routers that deliver the destination token in ONE user signature.
 * Copied from useSwapQuote — keep the two lists identical.
 */
const ONE_SIG_AGGREGATORS = new Set([
    'lifi', 'relay', 'mayan', 'squid', 'across', 'wormhole', 'thorchain',
    'maya', 'chainflip', 'rubic', 'stonfi', 'cetus', 'thala', 'skip', 'unisat', 'jupiter',
    // CCTP rail: user signs only on the source (relayer delivers on dest) = one signature.
    'tiwi-cctp',
    // Meson stablecoin rail: approve once + sign once, relayer fills dest = one signature.
    'meson',
]);

/** Format an output amount to 6 dp for display. Port of useSwapQuote's helper. */
export function formatToSixDecimals(value: string): string {
    const num = Number(value);
    if (!isFinite(num)) return value;
    if (num === 0) return '0';

    if (num > 1000000) {
        if (value.includes('.')) {
            const [intPart, decimalPart] = value.split('.');
            return `${intPart}.${decimalPart.substring(0, 6)}`;
        }
        return value;
    }

    return num.toFixed(6).replace(/\.?0+$/, '');
}

/**
 * Fetch the best route for a pair.
 *
 * ONE source of truth: `/api/v1/route`. The backend runs every router adapter
 * (LiFi, Relay, Jupiter, Skip, Cetus, Meson, CCTP, the Tiwi contracts, …) and
 * returns a normalized `RouterRoute` — the exact object the executor engine
 * settles. Nothing is quoted client-side.
 */
export async function fetchSwapQuote(
    fromAmount: string,
    fromToken: TokenMinimal,
    toToken: TokenMinimal,
    fromAddress: string,
    recipient: string,
    slippage: number = 0.5,
    options?: { signal?: AbortSignal },
): Promise<SwapQuote> {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
        throw new Error('Invalid amount');
    }

    const { selectedGasTokenType, isAutoSlippage, pinnedPoolAddress, preferredRouter } = useSwapStore.getState();

    // Addresses are only sent when they're valid on the relevant chain — a
    // 0x… "recipient" on a Solana route makes the backend quote for an address
    // that can't receive, and the executor would then deliver there.
    let validFromAddress: string | undefined;
    if (fromAddress && isAddressChainCompatible(fromAddress, Number(fromToken.chainId))) {
        validFromAddress = fromAddress;
    }

    let validRecipient: string | undefined;
    if (recipient && isAddressChainCompatible(recipient, Number(toToken.chainId))) {
        validRecipient = recipient;
    } else if (fromAddress && isAddressChainCompatible(fromAddress, Number(toToken.chainId))) {
        validRecipient = fromAddress;
    }

    // Pair liquidity, computed exactly as useSwapQuote does: the MINIMUM of the
    // two tokens when both are known (conservative — the route has to work for
    // both legs), otherwise whichever one we have.
    //
    // Sending this is the single biggest lever on quote latency. When it's
    // absent the backend's auto-slippage service falls back to a DexScreener
    // pair lookup on EVERY quote: measured 2.0s–15.9s per request versus ~0.6s
    // when the client supplies it. Mobile never sent it, which is why quotes
    // felt so much slower here than on web.
    let liquidityUSD: number | undefined;
    if (fromToken.liquidity !== undefined && toToken.liquidity !== undefined) {
        liquidityUSD = Math.min(fromToken.liquidity, toToken.liquidity);
    } else if (fromToken.liquidity !== undefined) {
        liquidityUSD = fromToken.liquidity;
    } else if (toToken.liquidity !== undefined) {
        liquidityUSD = toToken.liquidity;
    }
    // A zero/NaN value would be treated as "not provided" by the backend anyway.
    if (!liquidityUSD || !isFinite(liquidityUSD) || liquidityUSD <= 0) {
        liquidityUSD = undefined;
    }

    const routeReq: RouteRequest = {
        fromToken: {
            chainId: Number(fromToken.chainId),
            address: fromToken.address,
            symbol: fromToken.symbol,
            decimals: fromToken.decimals,
        },
        toToken: {
            chainId: Number(toToken.chainId),
            address: toToken.address,
            symbol: toToken.symbol,
            decimals: toToken.decimals,
        },
        fromAmount,
        fromAddress: validFromAddress,
        recipient: validRecipient,
        // Fixed slippage sends the number; auto lets the backend pick per-route.
        slippage: isAutoSlippage ? undefined : slippage,
        slippageMode: isAutoSlippage ? 'auto' : 'fixed',
        order: 'RECOMMENDED',
        liquidityUSD,
        // Tiered gas-token tax only for BSC-internal swaps; cross-chain from BSC
        // uses the standard tier (the relayer can't handle cross-chain).
        gasTokenType: isBscOnlySwap(fromToken, toToken) ? selectedGasTokenType : GasTokenType.BNB,
        // Deep-linked from a TIWI pool page: force the swap through that exact
        // TiwiLiquidityPair instead of letting the aggregators pick a market.
        // The backend re-checks that the pair really trades this token pair and
        // falls back to normal routing if not, so this can only ever narrow.
        ...(pinnedPoolAddress && preferredRouter
            ? { poolAddress: pinnedPoolAddress, preferredRouter }
            : {}),
    };

    const response: any = await api.route.get(routeReq, { signal: options?.signal });

    // "No route" is a VALID outcome (illiquid / unsupported pair) — the API
    // returns { noRoute: true } on HTTP 200. Give the honest, chain-specific
    // message instead of a generic failure.
    if (response?.noRoute || (!response?.route && !response?.error)) {
        const sym = toToken.symbol || 'this token';
        let chainName = 'this network';
        try {
            chainName = getCanonicalChain(Number(toToken.chainId))?.name || chainName;
        } catch { /* keep default */ }

        throw new Error(
            response?.reason === 'unsupported_pair'
                ? `[NO_LIQUIDITY] This swap isn't supported on ${chainName}.`
                : `[NO_LIQUIDITY] No liquidity for ${sym} on ${chainName} — this token has no tradeable pool here.`,
        );
    }

    if (response?.error) {
        throw new Error(response.error);
    }

    let route: RouterRoute | undefined = response?.route;
    let alternatives: RouterRoute[] = response?.alternatives || [];

    // One-signature cross-chain: prefer a single-aggregator route that delivers
    // the destination token in ONE signature over a multi-step swap→bridge→swap.
    if (route && route.fromToken.chainId !== route.toToken.chainId) {
        const isOneSig = (r: RouterRoute) => ONE_SIG_AGGREGATORS.has(r.router);
        const cands = [route, ...alternatives].filter(Boolean);
        const oneSig = cands
            .filter((r) => isOneSig(r) && swapExecutor.canExecute(r))
            .sort((a, b) => parseFloat(b.toToken.amount || '0') - parseFloat(a.toToken.amount || '0'));

        if (oneSig.length > 0 && !isOneSig(route)) {
            console.warn(`[SwapService] Cross-chain: switching "${route.router}" → one-signature "${oneSig[0].router}"`);
            alternatives = cands.filter((r) => r !== oneSig[0]);
            route = oneSig[0];
        }
    }

    // Only serve a route an executor can actually settle. If the winner can't be
    // executed here (e.g. a universal/V3 route on a chain where TiwiMultiSwap
    // isn't deployed), fall back to the best executable alternative.
    if (route && !swapExecutor.canExecute(route)) {
        const executable = alternatives.find((alt) => swapExecutor.canExecute(alt));
        if (executable) {
            console.warn(`[SwapService] Winning route "${route.router}" not executable here; using "${executable.router}"`);
            alternatives = alternatives.filter((a) => a !== executable);
            route = executable;
        } else {
            console.warn(`[SwapService] No executable route for this pair/chain (winner: "${route.router}")`);
        }
    }

    if (!route || !route.router || !route.fromToken || !route.toToken || !route.toToken.amount) {
        console.error('[SwapService] Invalid route response:', response);
        throw new Error('Invalid route response from server');
    }

    // Background: pre-check TiwiDEX contract viability for BSC swaps, so the
    // single-signature path is already resolved by the time the user taps Swap.
    if (Number(fromToken.chainId) === 56 && Number(toToken.chainId) === 56) {
        import('@/services/swap/core/executors/tiwi-protocol-dex-executor')
            .then((m) => m.TiwiProtocolDEXExecutor.checkViability())
            .catch(() => { });
    }

    const router = route.router;

    return {
        toAmount: formatToSixDecimals(route.toToken.amount || '0'),
        fiatAmount: route.toToken.amountUSD || '0',
        fromAmountUSD: route.fromToken.amountUSD,
        toAmountUSD: route.toToken.amountUSD,
        slippage: parseFloat(route.slippage || String(slippage)) || slippage,
        gasEstimate: route.fees?.gasUSD || '0',
        gasFee: route.fees?.gasUSD ? `$${route.fees.gasUSD}` : '0',
        twcFee: '',
        source: [router ? router.charAt(0).toUpperCase() + router.slice(1) : 'Tiwi Router'],
        router,
        transactionRequest: response?.transactionRequest,
        raw: route.raw,
        quoteId: route.routeId,
        // The normalized route is what actually gets executed. Everything above
        // is display-only projection of it.
        route,
        alternatives,
        expiresAt: route.expiresAt,
    };
}

/**
 * Settle a quote.
 *
 * Mirrors `useSwapExecution.execute`: the cross-VM recipient guard, then
 * `swapExecutor.execute` with `isFeeOnTransfer: true`, and a resolved
 * `{ success: false }` treated as a failure rather than a success.
 */
export async function executeSwap(
    fromAmount: string,
    fromToken: TokenMinimal,
    toToken: TokenMinimal,
    fromAddress: string,
    recipientAddress: string,
    quote: SwapQuote,
    onStatusUpdate?: (status: SwapExecutionStatus) => void,
): Promise<{ txHash: string }> {
    const result = await unifiedSwapManager.execute(
        {
            fromAmount,
            fromToken,
            toToken,
            fromAddress,
            recipientAddress,
            quote,
        },
        { onStatusUpdate },
    );

    if (result.success && result.txHash) {
        return { txHash: result.txHash };
    }

    throw new Error(result.error || 'Swap execution failed');
}
