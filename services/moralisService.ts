import { APIToken } from './apiClient';
import { formatUnits } from 'viem';

const MORALIS_API_KEY = process.env.EXPO_PUBLIC_MORALIS_API_KEY;
const BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

export interface MoralisTokenBalance {
    token_address: string;
    symbol: string;
    name: string;
    logo?: string;
    thumbnail?: string;
    decimals: number;
    balance: string;
    balance_formatted: string;
    usd_value: number;
    usd_price: number;
    usd_price_24h_percent_change?: number;
    usd_value_24h_percent_change?: number;
    native_token?: boolean;
    portfolio_percentage?: number;
    verified_contract?: boolean;
}

export interface MoralisBalancesResponse {
    page: number;
    page_size: number;
    cursor?: string;
    result: MoralisTokenBalance[];
}

const CHAIN_MAP: Record<number, string> = {
    1: 'eth',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    8453: 'base',
    10: 'optimism',
};

class MoralisService {
    private async fetcher<T>(endpoint: string): Promise<T> {
        if (!MORALIS_API_KEY) {
            console.error('[MoralisService] API Key is missing. Please restart your Expo server with --clear to reload your .env file.');
            throw new Error('Moralis API Key missing');
        } else {
            console.log(`[MoralisService] API Key identified: ${MORALIS_API_KEY.substring(0, 5)}...${MORALIS_API_KEY.substring(MORALIS_API_KEY.length - 5)}`);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': MORALIS_API_KEY,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Moralis API Error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Get all token balances for a wallet across multiple chains using Moralis
     */
    async getWalletBalances(address: string, chainIds: number[]): Promise<APIToken[]> {
        try {
            const allTokens: APIToken[] = [];

            // Moralis can do multi-chain in some endpoints but usually it's per chain for tokens
            const results = await Promise.all(
                chainIds.map(async (chainId) => {
                    const moralisChain = CHAIN_MAP[chainId];
                    if (!moralisChain) return [];

                    try {
                        // 1. Fetch Token Balances
                        const tokenData = await this.fetcher<MoralisBalancesResponse>(
                            `/wallets/${address}/tokens?chain=${moralisChain}`
                        );

                        // 2. Fetch Native Liquidity Explicitly (Standard Fallback)
                        let nativeToken: APIToken | null = null;
                        try {
                            const nativeData = await this.fetcher<{ balance: string }>(
                                `/${address}/balance?chain=${moralisChain}`
                            );

                            if (nativeData && BigInt(nativeData.balance) > 0n) {
                                // Map Chain ID to Native Symbol/Decimal
                                const NATIVE_META: Record<number, { symbol: string, name: string, decimals: number }> = {
                                    1: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
                                    56: { symbol: 'BNB', name: 'BNB', decimals: 18 },
                                    137: { symbol: 'MATIC', name: 'Polygon', decimals: 18 },
                                    42161: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
                                    8453: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
                                    10: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
                                };
                                const meta = NATIVE_META[chainId] || { symbol: 'ETH', name: 'Native', decimals: 18 };

                                // Use the conventional 0x0...0 for native, as requested by project consistency
                                const NATIVE_ADDR = '0x0000000000000000000000000000000000000000';

                                nativeToken = {
                                    address: NATIVE_ADDR,
                                    symbol: meta.symbol,
                                    name: meta.name,
                                    decimals: meta.decimals,
                                    balance: nativeData.balance,
                                    balanceFormatted: formatUnits(BigInt(nativeData.balance), meta.decimals),
                                    usdValue: '0',
                                    priceUSD: '0',
                                    chainId: chainId,
                                    verified: true,
                                };
                            }
                        } catch (nativeErr: any) {
                            if (nativeErr.message.includes("Invalid signature") || nativeErr.message.includes("401")) {
                                console.error(`[MoralisService] API Key Rejected for Native fetch on ${moralisChain}. Check your .env key.`);
                            } else {
                                console.warn(`[MoralisService] Native fetch failed for ${moralisChain}:`, nativeErr.message);
                            }
                        }

                        const tokens = (tokenData.result || [])
                            .map(token => {
                                // A token is verified if it's explicitly native OR a verified contract
                                // OR if it's a known native symbol (conservative fallback)
                                const isVerified =
                                    token.native_token === true ||
                                    token.verified_contract === true ||
                                    (token.symbol === 'BNB' && chainId === 56) ||
                                    (token.symbol === 'MATIC' && chainId === 137) ||
                                    (token.symbol === 'ETH' && [1, 42161, 8453, 10].includes(chainId));

                                return {
                                    address: token.token_address,
                                    symbol: token.symbol,
                                    name: token.name,
                                    decimals: token.decimals,
                                    balance: token.balance,
                                    balanceFormatted: token.balance_formatted,
                                    usdValue: token.usd_value?.toString() || '0',
                                    priceUSD: token.usd_price?.toString() || '0',
                                    logoURI: token.logo || token.thumbnail,
                                    chainId: chainId,
                                    priceChange24h: token.usd_price_24h_percent_change?.toString() || '0',
                                    verified: isVerified,
                                } as APIToken;
                            })
                            .filter(t => t.verified);

                        // Combine and deduplicate (favoring the one in the token list if it has price data)
                        if (nativeToken) {
                            const nativeInList = tokens.find(t => t.address.toLowerCase() === '0x0000000000000000000000000000000000000000');
                            if (!nativeInList) {
                                tokens.unshift(nativeToken);
                            }
                        }

                        return tokens;
                    } catch (e) {
                        console.error(`[MoralisService] Chain ${chainId} fetch error:`, e);
                        return [];
                    }
                })
            );

            results.forEach(tokens => allTokens.push(...tokens));
            return allTokens;
        } catch (error) {
            console.error('[MoralisService] Global fetch failed:', error);
            throw error;
        }
    }
}

export const moralisService = new MoralisService();
