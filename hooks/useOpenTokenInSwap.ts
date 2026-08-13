import { isRealTokenAddress, type MarketTokenLike } from '@/utils/market-token-resolver';
import { resolveTokenLogo } from '@/utils/admin-token-logos';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { isSameTokenAddress } from '@/utils/wallet';
import { formatTokenQuantity } from '@/utils/formatting';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Open the swap screen with `token` pre-filled as the "From" side.
 *
 * Used by every token row the user can tap outside the wallet — the Market
 * screen, the home Market section and the home Spotlight chips.
 *
 * Two kinds of row arrive here:
 *   • Rows that already know their contract (Spotlight / Listing entries, TWC,
 *     search hits) go through the swap screen's normal deep-link path.
 *   • Rows from the aggregate market feed carry a provider slug ("bitcoin") and
 *     a hardcoded `chainId: 1`. Those get `needsResolve`, and the swap screen
 *     looks up the real token before seeding it. See utils/market-token-resolver.
 */
/** Which curated tab a row was tapped from, if any. */
export interface OpenTokenInSwapOptions {
    /**
     * Only Listing and Spotlight rows carry the admin-authored About/Links
     * through to the swap screen. Explore, Gainers, Losers and Favourites open a
     * plain swap screen with no token overview.
     */
    infoSource?: 'listing' | 'spotlight';
}

export function useOpenTokenInSwap() {
    const router = useRouter();
    const { data: balanceData } = useWalletBalances();

    return useCallback(
        (token: MarketTokenLike, options?: OpenTokenInSwapOptions) => {
            // CEX pairs come through as `BTCUSDT` / `TWC-USDT`; the base ticker
            // is what identifies the asset.
            const symbol = (token.displaySymbol || token.symbol || '').split('-')[0].split('/')[0].trim();
            if (!symbol) return;

            const address = (token.address || '').trim();
            const chainId = Number(token.chainId);
            const hasRealIdentity =
                isRealTokenAddress(address) && Number.isFinite(chainId) && chainId > 0;

            const logo = resolveTokenLogo({
                address,
                chainId,
                logoURI: typeof token.logoURI === 'string' ? token.logoURI : undefined,
                logo: typeof token.logo === 'string' ? token.logo : undefined,
            });

            const price = token.priceUSD ?? token.price;
            const walletToken = hasRealIdentity
                ? balanceData?.tokens.find((t: any) =>
                    isSameTokenAddress(t.address, address) &&
                    Number(t.chainId) === Number(chainId)
                )
                : null;
            const walletBalance = walletToken
                ? `${formatTokenQuantity(walletToken.balanceFormatted || '0')} ${symbol}`
                : undefined;
            const walletValue = walletToken
                ? `$${parseFloat(walletToken.usdValue || '0').toFixed(2)}`
                : undefined;

            router.push({
                pathname: '/swap',
                params: {
                    assetId: address || symbol,
                    symbol,
                    name: token.name || symbol,
                    chainId: chainId > 0 ? String(chainId) : undefined,
                    logo,
                    balance: walletBalance,
                    usdValue: walletValue,
                    decimals: walletToken?.decimals != null ? String(walletToken.decimals) : undefined,
                    priceUSD: price != null ? String(price) : undefined,
                    needsResolve: hasRealIdentity ? undefined : '1',
                    infoSource: options?.infoSource,
                },
            } as any);
        },
        [balanceData, router],
    );
}
