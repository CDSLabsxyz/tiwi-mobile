import { apiClient, APIToken } from '@/services/apiClient';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';

export function useWalletBalances() {
    const { connectedWallets } = useWalletStore();

    return useQuery({
        queryKey: ['walletBalances', connectedWallets.map(w => w.address)],
        queryFn: async () => {
            if (connectedWallets.length === 0) return { tokens: [], totalNetWorthUsd: '0.00' };

            const balancePromises = connectedWallets.map(wallet =>
                apiClient.getWalletBalances(wallet.address)
            );

            const results = await Promise.all(balancePromises);

            // Aggregate tokens and calculate total USD value
            const allTokens: APIToken[] = [];
            let totalUSD = 0;

            results.forEach(res => {
                allTokens.push(...res.balances);
                totalUSD += parseFloat(res.totalUSD || '0');
            });

            // Simple deduplication/consolidation by token address and chainId
            const consolidatedTokens = allTokens.reduce((acc, token) => {
                const key = `${token.chainId}-${token.address}`;
                if (!acc[key]) {
                    acc[key] = { ...token };
                } else {
                    // Add balances if same token on same chain
                    acc[key].balance = (parseFloat(acc[key].balance) + parseFloat(token.balance)).toString();
                    acc[key].usdValue = (parseFloat(acc[key].usdValue || '0') + parseFloat(token.usdValue || '0')).toString();
                    acc[key].balanceFormatted = `${parseFloat(acc[key].balance).toFixed(4)} ${token.symbol}`;
                }
                return acc;
            }, {} as Record<string, APIToken>);

            return {
                tokens: Object.values(consolidatedTokens),
                totalNetWorthUsd: totalUSD.toFixed(2),
            };
        },
        enabled: connectedWallets.length > 0,
        staleTime: 1000 * 60, // 1 minute
    });
}
