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
    usd_price_24hr_percent_change?: number; // Moralis V2.2 uses 'hr'
    usd_value_24hr_percent_change?: number;
    native_token?: boolean;
    portfolio_percentage?: number;
    verified_contract?: boolean;
    possible_spam?: boolean;
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
                    if (!moralisChain) {
                        console.warn(`[MoralisService] No Moralis chain mapping for chainId: ${chainId}`);
                        return [];
                    }

                    try {
                        // 1. Fetch ALL Tokens (ERC20 + Native) using Optimized Wallet API
                        const tokenData = await this.fetcher<MoralisBalancesResponse>(
                            `/wallets/${address}/tokens?chain=${moralisChain}&exclude_spam=true`
                        );
                        console.log(`[MoralisService] Raw token data for ${moralisChain}: ${tokenData.result?.length || 0} items`);

                        const tokens = (tokenData.result || [])
                            .map(token => {
                                // A token is verified if it's explicitly native OR a verified contract
                                // OR if it's a known native symbol (conservative fallback)
                                const isVerified =
                                    (token.native_token === true || token.verified_contract === true) &&
                                    token.possible_spam !== true;

                                return {
                                    // Map Moralis fields to our APIToken interface
                                    address: (token.token_address || '').toLowerCase(),
                                    symbol: token.symbol,
                                    name: token.name,
                                    decimals: token.decimals,
                                    balance: token.balance,
                                    balanceFormatted: token.balance_formatted,
                                    usdValue: token.usd_value?.toString() || '0',
                                    priceUSD: token.usd_price?.toString() || '0',
                                    logoURI: token.logo || token.thumbnail,
                                    chainId: chainId,
                                    // CRITICAL: use 'usd_price_24hr_percent_change' (with 'r') as per Moralis V2.2 API
                                    priceChange24h: token.usd_price_24hr_percent_change?.toString() || '0',
                                    verified_contract: token.verified_contract === true,
                                    possible_spam: token.possible_spam === true,
                                    native_token: token.native_token === true,
                                } as any;
                            });

                        console.log(`[MoralisService] Found ${tokens.length} total tokens on ${moralisChain}`);
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

    /**
     * Get transaction history for a wallet using Moralis
     */
    async getWalletHistory(address: string, chainIds: number[], limit = 50): Promise<any[]> {
        try {
            const allTx: any[] = [];
            const results = await Promise.all(
                chainIds.map(async (chainId) => {
                    const moralisChain = CHAIN_MAP[chainId];
                    if (!moralisChain) return [];

                    try {
                        const response = await this.fetcher<any>(
                            `/wallets/${address}/history?chain=${moralisChain}&limit=${limit}`
                        );
                        return (response.result || []).map((tx: any) => ({
                            ...tx,
                            chainId,
                            // Map Moralis fields to internal shape
                            id: tx.hash,
                            type: tx.category === 'token' ? 'swap' : (tx.from_address?.toLowerCase() === address.toLowerCase() ? 'sent' : 'received'),
                            tokenSymbol: tx.token_symbol,
                            tokenAddress: tx.token_address,
                            amountFormatted: tx.value_decimal,
                            usdValue: tx.value_usd ? `$${parseFloat(tx.value_usd).toFixed(2)}` : '$0.00',
                            timestamp: new Date(tx.block_timestamp).getTime(),
                        }));
                    } catch (e) {
                        return [];
                    }
                })
            );

            results.forEach(txs => allTx.push(...txs));
            return allTx.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error('[MoralisService] History fetch failed:', error);
            return [];
        }
    }
}

export const moralisService = new MoralisService();
