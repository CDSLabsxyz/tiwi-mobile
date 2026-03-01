import { moralisService } from '@/services/moralisService';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';

// Major chains supported by Moralis/Tiwi
const SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161, 8453, 10]; // ETH, BSC, Polygon, Arb, Base, OP

export function useWalletBalances() {
    const { activeAddress, _hasHydrated } = useWalletStore();

    const queryAddresses = activeAddress ? [activeAddress] : [];
    console.log(`[useWalletBalances] Hook called. Hydrated: ${_hasHydrated}, Active: ${activeAddress}`);

    return useQuery({
        queryKey: ['walletBalances', queryAddresses, SUPPORTED_CHAIN_IDS],
        queryFn: async () => {
            if (!_hasHydrated) return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            if (queryAddresses.length === 0) {
                console.log('[useWalletBalances] No address to query');
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }

            try {
                const address = queryAddresses[0];
                console.log(`[useWalletBalances] Starting Moralis scan for: ${address}`);

                // Fetch from Moralis directly
                const allTokens = await moralisService.getWalletBalances(address, SUPPORTED_CHAIN_IDS);
                console.log(`[useWalletBalances] Moralis returned ${allTokens.length} tokens for ${address}`);

                let totalUSD = 0;
                let yesterdayTotalUSD = 0;

                allTokens.forEach(token => {
                    const currentVal = parseFloat(token.usdValue || '0');
                    totalUSD += currentVal;
                    console.log(` - Token: ${token.symbol}, Value: ${currentVal}`);

                    const changePercent = parseFloat(token.priceChange24h || '0');
                    const historicalVal = currentVal / (1 + (changePercent / 100));
                    yesterdayTotalUSD += historicalVal;
                });

                console.log(`[useWalletBalances] Final Total USD: ${totalUSD}`);

                // Filter the UI list to only show VERIFIED tokens, but the total balance includes ALL
                const filteredTokens = allTokens.filter(t => t.verified === true);
                console.log(`[useWalletBalances] Filtered to ${filteredTokens.length} verified tokens for UI`);

                const finalResult = {
                    tokens: filteredTokens.sort((a, b) => parseFloat(b.usdValue || '0') - parseFloat(a.usdValue || '0')),
                    totalNetWorthUsd: totalUSD.toFixed(2),
                    portfolioChange: {
                        amount: (totalUSD - yesterdayTotalUSD).toFixed(2),
                        percent: yesterdayTotalUSD > 0 ? (((totalUSD - yesterdayTotalUSD) / yesterdayTotalUSD) * 100).toFixed(2) : '0.00',
                    }
                };
                console.log('[useWalletBalances] Returning total balance:', finalResult.totalNetWorthUsd);
                return finalResult;
            } catch (error) {
                console.error('[useWalletBalances] Moralis fetch failed:', error);
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }
        },
        enabled: _hasHydrated && queryAddresses.length > 0,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        staleTime: 1000 * 60, // 1 min for Moralis to save on API calls
    });
}
