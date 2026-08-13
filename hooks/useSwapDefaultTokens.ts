import { api, type SwapDefaultToken } from '@/lib/mobile/api-client';
import { registerAdminTokenLogoOverrides, resolveTokenLogo } from '@/utils/admin-token-logos';
import { useQuery } from '@tanstack/react-query';

export const SWAP_DEFAULT_TOKENS_QUERY_KEY = ['swap-default-tokens'] as const;

/**
 * The admin-curated token list (`/api/v1/swap-default-tokens`) — roughly five
 * headline tokens per chain with TWC pinned at rank 1.
 *
 * This is what the web token selector browses. `/api/v1/tokens` is a raw
 * index and is only appropriate once the user is actively searching; see
 * TokenSelectSheet for how the two are combined.
 *
 * Mirrors the web's query options (5-minute staleTime, 30-minute gcTime) so
 * the list stays put across sheet opens instead of refetching each time.
 */
export function useSwapDefaultTokens({ enabled = true }: { enabled?: boolean } = {}) {
    return useQuery<SwapDefaultToken[]>({
        queryKey: SWAP_DEFAULT_TOKENS_QUERY_KEY,
        queryFn: async ({ signal }) => {
            const resp = await api.tokens.swapDefaults({ signal });
            const tokens = resp.tokens || [];
            registerAdminTokenLogoOverrides(tokens);
            return tokens.map((token) => ({
                ...token,
                logo: resolveTokenLogo(token) || token.logo,
            }));
        },
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
}
