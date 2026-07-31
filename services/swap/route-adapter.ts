/**
 * Token widening for the swap engine.
 *
 * The executors read the web app's richer `Token` shape; the swap screen works
 * with the leaner `TokenMinimal`. This is the only conversion needed — the
 * ROUTE itself is never synthesized here. It always comes from the backend
 * (`/api/v1/route`) exactly as it does on web, because only the backend's
 * normalized route carries the fee mode, per-step dexIds/router addresses and
 * quote expiry that the executors depend on.
 */

import type { Token } from '@/services/swap/core/token-types';
import type { TokenMinimal } from './types';

export function toCoreToken(token: TokenMinimal): Token {
    return {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        chainId: Number(token.chainId),
        logoURI: token.logoURI,
        price: token.priceUSD,
        name: token.symbol,
    };
}
