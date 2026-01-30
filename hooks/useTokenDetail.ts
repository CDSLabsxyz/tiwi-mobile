import { apiClient, TokenMetadata } from '@/services/apiClient';
import { CoinGeckoService } from '@/services/coingeckoService';
import { useQuery } from '@tanstack/react-query';

interface UseTokenDetailParams {
    address?: string;
    chainId?: number;
    symbol?: string;
    enabled?: boolean;
}

/**
 * Hook to fetch detailed token metadata and market stats
 */
export function useTokenDetail({ address, chainId, symbol, enabled = true }: UseTokenDetailParams) {
    return useQuery({
        queryKey: ['tokenDetail', address, chainId, symbol],
        queryFn: async (): Promise<TokenMetadata | null> => {
            if (!address && !symbol) return null;

            // 1. Try fetching from CoinGecko using the 'address' as the Coin ID
            // Simple heuristic: If it's not a standard EVM address (0x...), assume it might be a CG ID.
            // Even if it is 0x, some CG IDs are weird, but for now let's prioritize the specific instruction:
            // "address isn't actually the address... It's actually the CoinGecko ID".
            if (address) {
                const cgData = await CoinGeckoService.fetchCoinDetails(address);
                if (cgData) {
                    return cgData as TokenMetadata;
                }
            }

            // 2. Fallback to existing backend API if CoinGecko fails or returns null
            const params: any = { limit: 1 };
            if (address) params.address = address;
            if (chainId) params.chains = [chainId];
            if (symbol && !address) params.query = symbol;

            try {
                const tokens = await apiClient.getTokens(params);
                if (tokens.length > 0) {
                    const token = tokens[0];
                    return {
                        ...token,
                        priceUSD: token.priceUSD || '0',
                        priceChange24h: token.priceChange24h || 0,
                        volume24h: token.volume24h || 0,
                        marketCap: token.marketCap || 0,
                        circulatingSupply: token.circulatingSupply || 0,
                        totalSupply: token.totalSupply || 0,
                        maxSupply: token.maxSupply || 0,
                        liquidity: token.liquidity || 0,
                        verified: token.verified || false,
                    };
                }
            } catch (err) {
                console.warn("Backend token fetch failed:", err);
            }
            return null;
        },
        enabled: enabled && (!!address || !!symbol),
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Poll every minute
    });
}
