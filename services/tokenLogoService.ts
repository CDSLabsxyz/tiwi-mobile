/**
 * Unified Token Logo Service
 *
 * Fetches and caches token logos from multiple sources:
 *   1. CoinGecko  — best coverage, reliable CDN (coin-images.coingecko.com)
 *   2. Koin Gallery — returns coinmarketcap/coingecko CDN URLs
 *   3. DexScreener — dynamic URL from chain + address
 *   4. TrustWallet GitHub — open-source fallback for EVM tokens
 *
 * The cache warms once on first call and is reused for the app lifetime.
 */

const COINGECKO_API_KEY = 'CG-H5hx3pVrExRw76mpSVmATxTq';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const KOINGALLERY_API_KEY = process.env.EXPO_PUBLIC_KOINGALLERY_API_KEY || '';
const KOINGALLERY_BASE = 'https://koingallery.xyz/api';

// ── In-memory cache ──
// symbol (uppercased) → logo URL
let logoCache: Record<string, string> = {};
let cacheReady = false;
let fetchPromise: Promise<void> | null = null;

// ── CoinGecko ──

async function fetchCoinGeckoLogos(): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    try {
        // /coins/markets returns up to 250 coins per page with image field
        const res = await fetch(
            `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`,
            { headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY } },
        );
        if (!res.ok) return map;

        const coins: Array<{ symbol: string; image: string }> = await res.json();
        for (const c of coins) {
            if (c.image && c.symbol) {
                map[c.symbol.toUpperCase()] = c.image;
            }
        }
    } catch {
        // non-fatal
    }
    return map;
}

// ── Koin Gallery ──

async function fetchKoinGalleryLogos(): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    try {
        const res = await fetch(
            `${KOINGALLERY_BASE}/tokens?limit=200&sort=market_cap&order=desc`,
            { headers: { 'X-API-Key': KOINGALLERY_API_KEY } },
        );
        if (!res.ok) return map;

        const json = await res.json();
        const tokens: Array<{ symbol: string; logo_url: string }> = json.data || [];
        for (const t of tokens) {
            if (t.logo_url && t.symbol) {
                map[t.symbol.toUpperCase()] = t.logo_url;
            }
        }
    } catch {
        // non-fatal
    }
    return map;
}

// ── DexScreener (constructed URLs, no fetch needed) ──

const DEXSCREENER_CHAIN_SLUGS: Record<number, string> = {
    1: 'ethereum',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    8453: 'base',
    10: 'optimism',
    43114: 'avalanche',
    59144: 'linea',
    250: 'fantom',
    42220: 'celo',
    100: 'gnosischain',
    7565164: 'solana',
    1100: 'ton',
    728126428: 'tron',
};

const NATIVE_TOKEN_ADDRESSES: Record<number, string> = {
    1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    56: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    137: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    8453: '0x4200000000000000000000000000000000000006',
    10: '0x4200000000000000000000000000000000000006',
    43114: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    7565164: 'So11111111111111111111111111111111111111112',
};

export function getDexScreenerLogo(chainId?: number, address?: string): string | undefined {
    if (!chainId) return undefined;
    const slug = DEXSCREENER_CHAIN_SLUGS[chainId];
    if (!slug) return undefined;

    const isNative = !address
        || address === 'native'
        || address === '0x0000000000000000000000000000000000000000'
        || address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    const tokenAddr = isNative ? NATIVE_TOKEN_ADDRESSES[chainId] : address;
    if (!tokenAddr) return undefined;

    return `https://dd.dexscreener.com/ds-data/tokens/${slug}/${tokenAddr}.png`;
}

// ── TrustWallet (constructed URLs for EVM tokens) ──

const TRUSTWALLET_CHAIN_SLUGS: Record<number, string> = {
    1: 'ethereum',
    56: 'smartchain',
    137: 'polygon',
    42161: 'arbitrum',
    8453: 'base',
    10: 'optimism',
    43114: 'avalanchec',
    59144: 'linea',
    250: 'fantom',
    42220: 'celo',
    100: 'xdai',
};

function getTrustWalletLogo(chainId?: number, address?: string): string | undefined {
    if (!chainId || !address) return undefined;
    const slug = TRUSTWALLET_CHAIN_SLUGS[chainId];
    if (!slug) return undefined;
    // TrustWallet only indexes checksummed EVM addresses, but lowercase works too
    if (address === 'native' || address.startsWith('0x000000')) return undefined;
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${slug}/assets/${address}/logo.png`;
}

// ── Cache warming ──

async function warmCache(): Promise<void> {
    if (cacheReady) return;
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
        try {
            // Fetch from both sources in parallel
            const [cgLogos, kgLogos] = await Promise.all([
                fetchCoinGeckoLogos(),
                fetchKoinGalleryLogos(),
            ]);

            // Merge: Koin Gallery first, then CoinGecko overwrites (higher quality)
            const merged: Record<string, string> = {};
            for (const [sym, url] of Object.entries(kgLogos)) {
                merged[sym] = url;
            }
            for (const [sym, url] of Object.entries(cgLogos)) {
                merged[sym] = url;
            }

            logoCache = merged;
            cacheReady = true;
        } catch {
            // If everything fails, cache stays empty — callers fall through to DexScreener
        }
    })();

    return fetchPromise;
}

// ── Public API ──

/**
 * Get the best available logo URL for a token.
 *
 * @param symbol  Token symbol (e.g. "ETH", "USDT")
 * @param chainId Chain ID (e.g. 56 for BSC)
 * @param address Token contract address
 */
export function getTokenLogo(symbol?: string, chainId?: number, address?: string): string | undefined {
    // 1. Cached logo from CoinGecko / Koin Gallery
    if (symbol) {
        const cached = logoCache[symbol.toUpperCase()];
        if (cached) return cached;
    }
    // 2. DexScreener — dynamic from chain + address
    const dex = getDexScreenerLogo(chainId, address);
    if (dex) return dex;
    // 3. TrustWallet — EVM tokens with known address
    const tw = getTrustWalletLogo(chainId, address);
    if (tw) return tw;

    return undefined;
}

/** Non-blocking cache prefetch. Call at app startup. */
export function prefetchTokenLogos(): void {
    warmCache();
}

/** Await cache readiness. Call before normalizing token lists. */
export async function ensureTokenLogos(): Promise<void> {
    return warmCache();
}
