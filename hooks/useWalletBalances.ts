import { apiClient, APIToken } from '@/services/apiClient';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';

export function useWalletBalances() {
    const { activeAddress, activeChain, walletGroups } = useWalletStore();

    // Safety check for initialization
    const identities = walletGroups || [];

    // Logic: If we have an active address, we fetch balance for it.
    // In Phase 3, we want to optimize and typically only fetch the active identity's data
    // to save Moralis/RPC units.
    const queryAddresses = activeAddress ? [activeAddress] : [];

    return useQuery({
        queryKey: ['walletBalances', queryAddresses, activeChain],
        queryFn: async () => {
            if (queryAddresses.length === 0) {
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }

            try {
                // Currently optimized to fetch only the active address balance
                // This drastically reduces API usage compared to fetching all connected wallets
                const results = await Promise.all(
                    queryAddresses.map(address => apiClient.getWalletBalances(address))
                );

                // Aggregate tokens and calculate total USD value
                const allTokens: APIToken[] = [];
                let totalUSD = 0;
                let yesterdayTotalUSD = 0;

                results.forEach(res => {
                    // Filter verified tokens only
                    const verifiedBalances = res.balances.filter(token => token.verified !== false);
                    allTokens.push(...verifiedBalances);

                    verifiedBalances.forEach(token => {
                        const currentVal = parseFloat(token.usdValue || '0');
                        totalUSD += currentVal;

                        const changePercent = parseFloat(token.priceChange24h || '0');
                        const historicalVal = currentVal / (1 + (changePercent / 100));
                        yesterdayTotalUSD += historicalVal;
                    });
                });

                const changeAmount = totalUSD - yesterdayTotalUSD;
                const changePercent = yesterdayTotalUSD > 0 ? (changeAmount / yesterdayTotalUSD) * 100 : 0;

                const consolidatedTokens = allTokens.reduce((acc, token) => {
                    const key = `${token.chainId}-${token.address}`;
                    if (!acc[key]) {
                        const tokenClone = { ...token };
                        const rawBalance = BigInt(token.balance || '0');
                        const divisor = BigInt(10 ** token.decimals);
                        const actualBalance = Number(rawBalance) / Number(divisor);
                        tokenClone.balanceFormatted = actualBalance.toString();
                        acc[key] = tokenClone;
                    } else {
                        const currentRaw = BigInt(acc[key].balance || '0');
                        const newRaw = BigInt(token.balance || '0');
                        const totalRaw = currentRaw + newRaw;
                        acc[key].balance = totalRaw.toString();
                        acc[key].usdValue = (parseFloat(acc[key].usdValue || '0') + parseFloat(token.usdValue || '0')).toString();
                        const divisor = BigInt(10 ** token.decimals);
                        const actualBalance = Number(totalRaw) / Number(divisor);
                        acc[key].balanceFormatted = actualBalance.toString();
                    }
                    return acc;
                }, {} as Record<string, APIToken>);

                return {
                    tokens: Object.values(consolidatedTokens),
                    totalNetWorthUsd: totalUSD.toFixed(2),
                    portfolioChange: {
                        amount: changeAmount.toFixed(2),
                        percent: changePercent.toFixed(2),
                    }
                };
            } catch (error) {
                console.error('Failed to fetch wallet balances:', error);
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }
        },
        enabled: queryAddresses.length > 0,
        staleTime: 1000 * 60 * 2, // Reduced to 2 minutes for more "real-time" feel in Phase 3
    });
}
