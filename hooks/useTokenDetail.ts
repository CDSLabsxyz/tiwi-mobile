import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';

interface UseTokenDetailParams {
    address?: string;
    chainId?: number;
    symbol?: string;
    enabled?: boolean;
}

/**
 * Hook to fetch detailed token metadata and market stats using the new SDK
 */
export function useTokenDetail({ address, chainId, symbol, enabled = true }: UseTokenDetailParams) {
    return useQuery({
        queryKey: ['tokenDetail', address, chainId, symbol],
        queryFn: async (): Promise<any | null> => {
            if (!address && !symbol) return null;

            // 1. Direct approach with new SDK if we have the identifiers
            if (address && chainId) {
                try {
                    const detail = await api.tokenInfo.get(chainId, address);
                    if (detail && detail.token) {
                        return {
                            ...detail.token,
                            id: `${chainId}-${address}`,
                            chainId,
                            priceUSD: detail.pool?.priceUsd?.toString() || '0',
                            priceChange24h: detail.pool?.priceChange24h || 0,
                            volume24h: detail.pool?.volume24h || 0,
                            marketCap: detail.pool?.marketCap || 0,
                            fdv: detail.pool?.fdv || 0,
                            liquidity: detail.pool?.liquidity || 0,
                            holders: detail.holders || 0,
                            verified: true,
                            logoURI: detail.token.logo,
                            description: detail.token.description || '',
                            socials: {
                                twitter: detail.token.twitter,
                                telegram: detail.token.telegram,
                                discord: detail.token.discord,
                                website: detail.token.website,
                            },
                            recentTrades: detail.transactions || [],
                        };
                    }
                } catch (e) {
                    console.warn("api.tokenInfo.get failed:", e);
                }
            }

            // 2. Fallback to search-based lookup via tokens module
            const params: any = { limit: 1 };
            if (address) params.address = address;
            if (chainId) params.chains = [chainId];
            if (symbol && !address) params.query = symbol;

            try {
                const response = await api.tokens.list(params);
                if (response.tokens && response.tokens.length > 0) {
                    const token = response.tokens[0];
                    return {
                        ...token,
                        priceUSD: token.priceUSD || '0',
                        priceChange24h: token.priceChange24h || 0,
                        volume24h: token.volume24h || 0,
                        marketCap: token.marketCap || 0,
                        circulatingSupply: token.circulatingSupply || 0,
                        totalSupply: token.totalSupply || 0,
                        liquidity: token.liquidity || 0,
                        verified: token.verified || false,
                    };
                }
            } catch (err) {
                console.warn("Backend token search failed:", err);
            }
            return null;
        },
        enabled: enabled && (!!address || !!symbol),
        staleTime: 30000,
        refetchInterval: 60000,
    });
}
