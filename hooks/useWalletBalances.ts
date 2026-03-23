import { api } from '@/lib/mobile/api-client';
import { useFilterStore } from '@/store/filterStore';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

// Major chains supported by Tiwi (defaults for fetching if no specific filter is active)
const ALL_SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161, 8453, 10, 43114, 59144, 250, 42220, 100, 7565164, 1100];

// Minimum USD value to show a token (set to 0.01 for dust, but we also show anything with balance > 0)
const MIN_USD_VALUE = 0.01;

export function useWalletBalances() {
    const { activeAddress, _hasHydrated } = useWalletStore();

    // Read the active chain filter from the global filter store
    // If no chain filter is selected, query all supported chains
    const selectedChains = useFilterStore((state) => state.chains);

    // Derive the chain IDs to pass to the API
    const chainIdsForFetch = useMemo(() => {
        if (selectedChains.size > 0) {
            return Array.from(selectedChains).map(Number).filter(n => !isNaN(n));
        }
        return ALL_SUPPORTED_CHAIN_IDS;
    }, [selectedChains]);

    return useQuery({
        // Re-fetch automatically when the chain filter changes
        queryKey: ['walletBalances', activeAddress, chainIdsForFetch],
        queryFn: async () => {
            if (!_hasHydrated || !activeAddress) {
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }

            try {
                // Fetch from unified backend API via SDK, passing the active chain filter
                const resp = await api.wallet.balances({
                    address: activeAddress,
                    chains: chainIdsForFetch,
                }) as any; // real API returns flat WalletToken[], not the nested shape typed in api-client.ts

                // The real API returns balances as a flat WalletToken[] array.
                // Each item already has: address, symbol, name, decimals, balance,
                //                        balanceFormatted, logoURI, chainId, usdValue,
                //                        priceUSD, priceChange24h, portfolioPercentage, etc.
                const rawBalances: any[] = Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);

                const tokens = rawBalances
                    // Remove invalid / incomplete entries
                    .filter(b => b && (b.address || b.symbol))
                    // Filter out dust, spam and unverified tokens with extreme prejudice
                    .filter(b => {
                        const usdValue = parseFloat(b.usdValue || '0');
                        const balance = parseFloat(b.balanceFormatted || '0');
                        const symbol = (b.symbol || '').toUpperCase();
                        const name = (b.name || '').toLowerCase();

                        const isVerified = b.verified === true;
                        const isTWC = symbol === 'TWC' || b.address?.toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596'.toLowerCase();

                        // Heuristic: Spam tokens often have URLs in their name or "Reward"/"Airdrop"
                        const spamKeywords = ['.com', '.xyz', '.org', 'claim', 'reward', 'airdrop', 'free', 'visit', 'voucher', 'gift', 'win', 'bonus', 'ticket', 'verify', 'receive', 'win', 'opn'];
                        const isSpamName = spamKeywords.some(kw => name.includes(kw) || symbol.toLowerCase().includes(kw));
                        if (isSpamName && !isVerified) return false;

                        // Detect native tokens and major trustable stables (sacred list)
                        const isSacred = b.address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'.toLowerCase() ||
                            b.address?.toLowerCase() === '0x0000000000000000000000000000000000000000'.toLowerCase() ||
                            name.includes('(native)') ||
                            ['ETH', 'BNB', 'SOL', 'TON', 'MATIC', 'AVAX', 'FTM', 'ARB', 'OP', 'BASE', 'USDT', 'USDC', 'DAI'].includes(symbol);

                        // Rule: Show if it's verified OR Tiwi CAT (TWC) OR it's a sacred/native token
                        if (isVerified || isTWC || isSacred) {
                            return usdValue >= MIN_USD_VALUE || balance > 0;
                        }

                        // For ALL other unverified "non-sacred" tokens:
                        // Require a significant balance value to hide "ghost" airdrops and dust scams.
                        // Raising limit to $10.00 as requested for "more filtering".
                        return (usdValue >= 10.00);
                    })
                    .map(b => ({
                        // Spread everything so all fields are available in the UI
                        ...b,
                        // Normalise aliases expected by the wallet screen
                        balanceFormatted: b.balanceFormatted || b.balance || '0',
                        usdValue: b.usdValue || '0',
                        logoURI: b.logoURI || b.logo,
                        priceChange24h: parseFloat(b.priceChange24h || '0'),
                    }));

                // Sort by USD value descending
                const sortedTokens = tokens.sort((a: any, b: any) =>
                    parseFloat(b.usdValue || '0') - parseFloat(a.usdValue || '0')
                );

                return {
                    tokens: sortedTokens,
                    totalNetWorthUsd: resp.totalUSD || '0.00',
                    portfolioChange: {
                        amount: resp.dailyChangeUSD
                            ? `${parseFloat(resp.dailyChangeUSD) >= 0 ? '+' : ''}$${Math.abs(parseFloat(resp.dailyChangeUSD)).toFixed(2)}`
                            : '+$0.00',
                        percent: resp.dailyChange
                            ? `${resp.dailyChange >= 0 ? '+' : ''}${resp.dailyChange.toFixed(2)}%`
                            : '+0.00%',
                    },
                };
            } catch (error) {
                console.error('[useWalletBalances] SDK fetch failed:', error);
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '+$0.00', percent: '+0.00%' } };
            }
        },
        enabled: _hasHydrated && !!activeAddress,
        refetchOnMount: true,
        staleTime: 1000 * 60, // 1 minute cache
    });
}
