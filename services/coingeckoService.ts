import { TokenMetadata } from "@/services/apiClient";

const COINGECKO_API_KEY = "CG-H5hx3pVrExRw76mpSVmATxTq"; // Demo key
const BASE_URL = "https://api.coingecko.com/api/v3";

// Mapping of CoinGecko 'asset_platform_id' to standard Chain IDs
// Note: Some IDs are well-known, others are inferred or placeholders where standard IDs aren't universal.
// Prioritizing major EVM chains and those supported by LiFi/1inch where possible.
export const CHAIN_MAP: Record<string, number> = {
    "ethereum": 1,
    "binance-smart-chain": 56,
    "polygon-pos": 137,
    "avalanche": 43114,
    "optimistic-ethereum": 10,
    "arbitrum-one": 42161,
    "fantom": 250,
    "base": 8453,
    "zksync": 324,
    "linea": 59144,
    "polygon-zkevm": 1101,
    "celo": 42220,
    "gnosis": 100,
    "moonriver": 1285,
    "moonbeam": 1284,
    "fuse": 122,
    "metis-andromeda": 1088,
    "kava": 2222,
    "canto": 7700,
    "aurora": 1313161554,
    "harmony-shard-0": 1666600000,
    "boba": 288,
    "cronos": 25,
    "telos": 40,
    "iotex": 4689,
    "klay-token": 8217, // Kaia/Klaytn
    "scroll": 534352,
    "mode": 34443,
    "manta-pacific": 169,
    "blast": 81457,
    "filecoin": 314,
    "zeta": 7000, // ZetaChain
    "zetachain": 7000,
    "core": 1116,
    "flare-network": 14,
    "songbird": 19,
    "astar": 592,
    "shiden": 336,
    "velas": 106,
    "meter": 82,
    "syscoin": 57,
    "thundercore": 108,
    "oasis-sapphire": 23294,
    "bitgert": 32520,
    "dogechain": 2000,
    "smartbch": 10000,
    "elastos": 20,
    "kardiachain": 24,
    "ronin": 2020,
    "wanchain": 888,
    "energi": 39797,
    "world-chain": 480, // Approximate/Check if mainnet ID is stable
    "solana": 1151111081099710, // Unofficial integer mapping often used for Solana in mixed contexts
    "tron": 728126428, // Unofficial integer mapping
    "xdai": 100, // Alias for Gnosis
    "shibarium": 109,
    "arbitrum-nova": 42170,
    "mantle": 5000,
    "rollux": 570,
    "pulsechain": 369,
    "syscoin-nevm": 57,
    "tenet": 1559,
    "boba-bnb": 56288,
    "ethereumpow": 10001,
    "ethereum-classic": 61,
    "step-network": 1234,
    "godwoken": 71402,
    "tomochain": 88, // Viction
    "platon-network": 210425,
    "exosama": 385,
    "oasys": 248,
    "wemix-network": 1111,
    "onus": 1975,
    "aptos": 100000000, // Placeholder
    "sui": 200000000, // Placeholder
    "sei-network": 1329,
    "sei-v2": 1329,
    "rootstock": 30,
    "neon-evm": 245022934,
    "opbnb": 204,
    "chiliz": 88888,
    "lukso": 42,
    "ancient8": 88888888,
    "x-layer": 196,
    "bsquared-network": 223,
    "bitlayer": 200901,
    "bob-network": 60808,
    "taiko": 167000,
    "fraxtal": 252,
    "zora-network": 7777777,
    "merlin-chain": 4200,
    "soneium": 1868,
    "lisk": 1135,
    "apechain": 33139,
    "morph-l2": 2818,
    "berachain": 80094,
    "unichain": 130,
    "hyperliquid": 999999999, // Placeholder
    "xdc-network": 50,
};

interface CoinGeckoResponse {
    id: string;
    symbol: string;
    name: string;
    asset_platform_id: string; // "ethereum", "binance-smart-chain", etc.
    platforms: Record<string, string>; // { "ethereum": "0x...", "solana": "..." }
    detail_platforms: Record<string, { decimal_place: number; contract_address: string; }>;
    market_data: {
        current_price: Record<string, number>;
        market_cap: Record<string, number>;
        total_volume: Record<string, number>;
        high_24h: Record<string, number>;
        low_24h: Record<string, number>;
        price_change_percentage_24h: number;
        circulating_supply: number;
        total_supply: number;
        max_supply: number;
        fully_diluted_valuation: Record<string, number>;
        market_cap_rank?: Record<string, number>;
    };
    image: {
        thumb: string;
        small: string;
        large: string;
    };
    links: {
        homepage: string[];
        twitter_screen_name: string;
        whitepaper: string;
    };
    description: Record<string, string>;
    market_cap_rank: number;
}

export const CoinGeckoService = {
    /**
     * Fetches detailed token information from CoinGecko by Coin ID.
     */
    async fetchCoinDetails(coinId: string): Promise<Partial<TokenMetadata> | null> {
        try {
            console.log(`fetching coingecko details for: ${coinId} (${BASE_URL}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false)`);
            const response = await fetch(`${BASE_URL}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`, {
                headers: {
                    'x-cg-demo-api-key': COINGECKO_API_KEY
                }
            });

            if (!response.ok) {
                console.warn(`CoinGecko API error: ${response.status} for ${coinId}`);
                return null;
            }

            const data: CoinGeckoResponse = await response.json();

            // Determine Primary Chain and Contract Address
            let chainId = 1; // Default to Ethereum
            let contractAddress = "";
            let decimals = 18;

            // Strategy: 
            // 1. Try to map 'asset_platform_id' directly.
            // 2. If valid platform found, get address from 'platforms'.
            // 3. Fallback: Check if 'ethereum' exists in platforms.

            const platformId = data.asset_platform_id;
            if (platformId && CHAIN_MAP[platformId]) {
                chainId = CHAIN_MAP[platformId];
                contractAddress = data.platforms[platformId];
                decimals = data.detail_platforms[platformId]?.decimal_place || 18;
            } else if (data.platforms['ethereum']) {
                // Fallback to ETH if main platform is unmapped but ETH exists (common for multi-chain tokens)
                chainId = 1;
                contractAddress = data.platforms['ethereum'];
                decimals = data.detail_platforms['ethereum']?.decimal_place || 18;
            } else {
                // Try to grab the first mapped platform available
                for (const [key, addr] of Object.entries(data.platforms)) {
                    if (CHAIN_MAP[key]) {
                        chainId = CHAIN_MAP[key];
                        contractAddress = addr;
                        decimals = data.detail_platforms[key]?.decimal_place || 18;
                        break;
                    }
                }
            }

            // Construct Social Links
            const twitterUrl = data.links.twitter_screen_name
                ? `https://twitter.com/${data.links.twitter_screen_name}`
                : undefined;

            const websiteUrl = data.links.homepage.find(url => url && url.length > 0);

            // Normalize to TokenMetadata
            const metadata: Partial<TokenMetadata> = {
                // Core
                address: contractAddress || coinId, // Fallback to ID if no address (e.g. BTC native)
                chainId: chainId,
                name: data.name,
                symbol: data.symbol.toUpperCase(),
                decimals: decimals,
                logoURI: data.image.large || data.image.small,
                verified: true,

                // Market Data
                priceUSD: data.market_data.current_price?.usd?.toString(),
                priceChange24h: data.market_data.price_change_percentage_24h,
                marketCap: data.market_data.market_cap?.usd,
                volume24h: data.market_data.total_volume?.usd,
                high24h: data.market_data.high_24h?.usd,
                low24h: data.market_data.low_24h?.usd,
                circulatingSupply: data.market_data.circulating_supply,
                totalSupply: data.market_data.total_supply,
                maxSupply: data.market_data.max_supply,
                marketCapRank: data.market_data.market_cap_rank,

                // Metadata
                description: data.description?.en || "",
                website: websiteUrl,
                twitter: twitterUrl,

                // Extra context
                chainName: platformId // Store the CG platform ID for reference
            };

            return metadata;

        } catch (error) {
            console.error("Failed to fetch CoinGecko details:", error);
            return null;
        }
    }
};
