/**
 * Route ↔ params token-identity alignment.
 *
 * Every executor selects itself with `canHandle(route)` but then executes against
 * `params.fromToken` / `params.toToken` (the tokens the user actually picked). When
 * those two disagree the wrong executor wins and dies mid-flight.
 *
 * The disagreement that actually happens is native ↔ wrapped-native: routing has to
 * swap BNB → WBNB to find a pair (a native coin is never one side of a DEX pair), so
 * a BNB → TWC route can come back labelled WBNB. BscNativeSwapExecutor then skips it
 * and BscDirectSwapExecutor takes it, calling ERC20 `balanceOf()` on the zero address
 * → `The contract function "balanceOf" returned no data ("0x")`.
 *
 * This restores the user's token identity on the route before executor selection.
 * `steps`/`raw` are untouched — the swap still has to trade through the wrapper.
 *
 * Ported from tiwi-user-app. The only difference is the wrapped-native lookup:
 * this app's registry exposes `isKnownWrappedNative(chainId, address)` in place of
 * the web app's `isWrappedNativeAddress`. Both are keyed by (chainId, address) —
 * never by symbol — because chains that fork each other share mint addresses.
 */

import type { RouterRoute } from '@/services/swap/core/router-types';
import type { SwapExecutionParams } from '../types';
import { isKnownWrappedNative } from '@/constants/wrappedNatives';

const NATIVE_TOKEN_ADDRESSES = [
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];

function isNativeAddress(address?: string): boolean {
    if (!address) return false;
    return NATIVE_TOKEN_ADDRESSES.includes(address.toLowerCase());
}

/**
 * True when `routeAddress` is the wrapped stand-in for the native coin the user
 * actually selected on that chain.
 */
function isWrappedStandIn(
    paramsAddress: string | undefined,
    routeAddress: string | undefined,
    chainId: number | undefined,
): boolean {
    if (!chainId || !isNativeAddress(paramsAddress)) return false;
    return isKnownWrappedNative(chainId, routeAddress);
}

/**
 * Returns the route re-labelled with the user's tokens, or the same object when
 * nothing needed changing (the common case).
 */
export function alignRouteTokensWithParams(params: SwapExecutionParams): RouterRoute {
    const { route, fromToken, toToken } = params;
    if (!route?.fromToken || !route?.toToken) return route;

    const fixFrom = isWrappedStandIn(fromToken?.address, route.fromToken.address, route.fromToken.chainId);
    const fixTo = isWrappedStandIn(toToken?.address, route.toToken.address, route.toToken.chainId);

    if (!fixFrom && !fixTo) return route;

    console.warn(
        '[SwapExecutor] Route labelled with wrapped native — restoring the user-selected token(s) ' +
        'so executor selection matches what is actually being spent/received:',
        {
            from: fixFrom ? `${route.fromToken.address} → ${fromToken.address}` : undefined,
            to: fixTo ? `${route.toToken.address} → ${toToken.address}` : undefined,
        },
    );

    return {
        ...route,
        fromToken: fixFrom
            ? { ...route.fromToken, address: fromToken.address, symbol: fromToken.symbol || route.fromToken.symbol }
            : route.fromToken,
        toToken: fixTo
            ? { ...route.toToken, address: toToken.address, symbol: toToken.symbol || route.toToken.symbol }
            : route.toToken,
    };
}
