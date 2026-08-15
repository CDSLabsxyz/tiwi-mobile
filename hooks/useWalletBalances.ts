import { KNOWN_CHAIN_IDS, NATIVE_SYMBOL_CHAINS } from '@/constants/knownChains';
import { isKnownWrappedNative } from '@/constants/wrappedNatives';
import { api, type PortfolioAddresses } from '@/lib/mobile/api-client';
import { fetchEvmTokenBalanceDetails, fetchSolanaTokenBalance } from '@/services/customTokenBalance';
import { fetchExtraNativeBalances } from '@/services/extraChainBalances';
import { moralisService } from '@/services/moralisService';
import { notificationService } from '@/services/notificationService';
import { ensureTokenLogos, getTokenLogo, prefetchTokenLogos } from '@/services/tokenLogoService';
import { useCustomTokenStore, type CustomToken } from '@/store/customTokenStore';
import { useFilterStore } from '@/store/filterStore';
import { useWalletStore, type WalletGroup } from '@/store/walletStore';
import { ensureAdminTokenLogoOverrides, getAdminTokenLogo, normalizeTokenLogoUrl, prefetchAdminTokenLogoOverrides, resolveTokenLogo } from '@/utils/admin-token-logos';
import { normalizeSolanaBalanceRow, SOLANA_NATIVE_ADDRESS } from '@/utils/solanaIdentity';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

// Kick off logo cache warming as early as possible (CoinGecko + Koin Gallery)
prefetchTokenLogos();
prefetchAdminTokenLogoOverrides();

// Nexxend-covered chains, used only by the legacy per-address fallback path.
// Discovery itself is UNFILTERED — the server portfolio route sweeps every
// chain in the registry and the UI applies the user's chain filter locally.
const FALLBACK_CHAIN_IDS = [1, 56, 137, 42161, 8453, 10, 43114, 999, 59144, 250, 42220, 100, 7565164, 1100];

const isEvmAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

/**
 * Map a wallet group's derived addresses onto the portfolio route's address
 * bag. One cosmos1… key covers the whole Cosmos family server-side (the route
 * re-encodes it per chain), so the individual cosmos-family keys are omitted.
 */
function portfolioAddressesFor(group: WalletGroup | undefined): PortfolioAddresses {
    const a = group?.addresses;
    if (!a) return {};
    const evm = a.EVM && isEvmAddress(a.EVM) ? a.EVM : undefined;
    return {
        EVM: evm,
        SOLANA: a.SOLANA || undefined,
        TRON: a.TRON || undefined,
        TON: a.TON || undefined,
        COSMOS: a.COSMOS || undefined,
        OSMOSIS: a.OSMOSIS || undefined,
        SUI: a.SUI || undefined,
        APTOS: a.APTOS || undefined,
        BITCOIN: a.BITCOIN || undefined,
        STARKNET: a.STARKNET || undefined,
        LITECOIN: a.LITECOIN || undefined,
        DOGECOIN: a.DOGECOIN || undefined,
        BITCOINCASH: a.BITCOINCASH || undefined,
        STACKS: a.STACKS || undefined,
    };
}

// Spam/quality filtering
const BLACKLISTED_SYMBOLS = ['SN3', 'BSB'];
// Native assets are never dropped for being cheap or logo-less — a real holding
// on a long-tail chain would otherwise vanish. Derived from the registry's
// native-symbol map plus the majors/stables users expect to always see.
const SACRED_SYMBOLS = [
    ...Object.keys(NATIVE_SYMBOL_CHAINS),
    'BASE', 'ARB', 'OP', 'USDT', 'USDC', 'DAI', 'CAKE',
];
// `native` is how the UTXO/Stacks/Bitcoin direct readers spell a native coin;
// EVM uses the zero-address sentinel and Solana the System Program. All sacred.
// (`So111…112` is WRAPPED SOL — a real, separate holding, kept sacred too.)
const SACRED_ADDRESSES = ['native', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000001010', SOLANA_NATIVE_ADDRESS, 'So11111111111111111111111111111111111111112'];
const SPAM_KEYWORDS = ['.com', '.xyz', '.net', '.io', '.org', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher', 'gift', 'win', 'bonus'];
const DUST_TOKEN_USD_CEILING = 0.01;
const UNVERIFIED_TOKEN_USD_CEILING = 1;

// Symbols that airdrop scammers commonly impersonate — stablecoins and
// wrapped tokens. A token claiming one of these symbols MUST sit at the
// officially-known contract address for its chain; otherwise it's the
// classic fake-USDC/fake-USDT scam with a bogus price feed.
const IMPERSONATED_STABLES = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'WETH', 'WBTC', 'WBNB', 'WMATIC', 'WAVAX']);

// The subset of the above that must trade at ~$1. Used to sanity-check the
// price on chains we have no official-address table for.
const PEGGED_STABLES = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX']);

// Official contract addresses (lowercased) for impersonated symbols,
// keyed by chainId. Anything else at the same symbol is spam.
const OFFICIAL_STABLE_ADDRESSES: Record<number, Record<string, string>> = {
    1: { // Ethereum
        USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        DAI:  '0x6b175474e89094c44da98b954eedeac495271d0f',
        BUSD: '0x4fabb145d64652a948d72533023f6e7a623c7c53',
        WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    },
    56: { // BSC
        USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        USDT: '0x55d398326f99059ff775485246999027b3197955',
        DAI:  '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
        BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        WETH: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
    },
    137: { // Polygon
        USDC:   '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        USDT:   '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        DAI:    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
        WETH:   '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        WMATIC: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    },
    42161: { // Arbitrum
        USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        DAI:  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
        WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        WBTC: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    },
    8453: { // Base
        USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        WETH: '0x4200000000000000000000000000000000000006',
        DAI:  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
    },
    10: { // Optimism
        USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        USDT: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
        DAI:  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
        WETH: '0x4200000000000000000000000000000000000006',
        WBTC: '0x68f180fcce6836688e9084f035309e29bf0a2095',
    },
    43114: { // Avalanche
        USDC:  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
        USDT:  '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
        DAI:   '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
        WETH:  '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
        WBTC:  '0x50b7545627a5162f82a992c33b87adc75187b218',
        WAVAX: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    },
    59144: { // Linea
        USDC: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
        USDT: '0xa219439258ca9da29e9cc4ce5596924745e12b93',
        WETH: '0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f',
    },
    250: { // Fantom
        USDC: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
        USDT: '0x049d68029688eabf473097a2fc38ef61633a3c7a',
        DAI:  '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e',
    },
    42220: { // Celo
        USDC: '0xceba9300f2b948710d2653dd7b07f33a8b32118c',
        USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
    },
    100: { // Gnosis — the one catching the fake USDC the user keeps seeing
        USDC: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
        USDT: '0x4ecaba5870353805a9f068101a40e0f32ed605c6',
    },
    7565164: { // Solana
        USDC: 'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v',
        USDT: 'es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb',
    },
};

// Native symbols can ONLY exist on their home chain — a token claiming to be
// "BNB" on chain 1100 (TON) is scam/corrupt data. The map is registry-derived
// (constants/knownChains.ts) so every legitimate home chain is covered; WBNB is
// the one wrapped symbol we pin, since it's a common impersonation target.
const WRAPPED_NATIVE_CHAINS: Record<string, number[]> = { WBNB: [56] };

function nativeHomeChains(symbol: string): number[] | undefined {
    return NATIVE_SYMBOL_CHAINS[symbol] || WRAPPED_NATIVE_CHAINS[symbol];
}

/**
 * Phishing/airdrop-spam patterns, copied verbatim from the web app's
 * `SPAM_TOKEN_PATTERNS` (tiwi-user-app/hooks/useWalletBalances.ts) so both apps
 * retire exactly the same rows. Matched against `symbol + name`.
 */
const SPAM_TOKEN_PATTERNS: RegExp[] = [
    /https?:\/\//i,
    /www\./i,
    /\bt\.me\b/i,
    /[a-z0-9-]{2,}\.(com|org|net|io|xyz|app|finance|site|club|vip|live|info|top|gift|claim|fund|pro)\b/i,
    /\b(visit|claim|redeem|reward|rewards|airdrop|voucher|access|bonus|giveaway|telegram)\b/i,
    /[←-⇿⌀-➿⬀-⯿️\u{1F000}-\u{1FAFF}]/u,
];

function isLikelySpamToken(token: { symbol?: string; name?: string }): boolean {
    const text = `${token.symbol || ''} ${token.name || ''}`;
    return SPAM_TOKEN_PATTERNS.some((re) => re.test(text));
}

function signalNumber(value: any): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value || '0'));
    return Number.isFinite(n) ? n : 0;
}

function hasMarketActivitySignal(token: any): boolean {
    return signalNumber(token.marketCap) >= 10_000
        || signalNumber(token.liquidity) >= 1_000
        || signalNumber(token.volume24h) >= 200
        || signalNumber(token.holders) >= 50
        || signalNumber(token.transactionCount) >= 10;
}

function hasVerifiedSourceSignal(token: any): boolean {
    return token.verified === true
        || token.verified_contract === true
        || token.verifiedContract === true
        || token.native_token === true;
}

function isExplicitlyUnverified(token: any): boolean {
    return token.verified === false
        || token.verified_contract === false
        || token.verifiedContract === false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-refetch stability — the other half of the web app's `finalize()`.
//
// Every refetch rebuilds the portfolio from ~a dozen independent, individually
// flaky sources. Judging a token on ONE snapshot means a source that timed out,
// or a price lookup that got rate-limited, deletes a real holding. The web app
// gives each row a few cycles of grace; these module-level maps do the same.
// ─────────────────────────────────────────────────────────────────────────────

const MISSING_GRACE_CYCLES = 3;  // consecutive absences before a token is gone

const lastGoodTokens = new Map<string, any[]>();
const missingStrikes = new Map<string, number>();

// Every spelling a source has used for "this chain's own coin". Sources
// disagree — Nexxend says 'native', the direct RPC readers say the zero
// address, Moralis says 0xeee…e — and the SAME holding can arrive under a
// different one on each refetch, since dedupe keeps whichever row priced
// higher and that flips with the price source.
const NATIVE_ADDRESS_ALIASES = new Set([
    '',
    'native',
    'null',
    'undefined',
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    SOLANA_NATIVE_ADDRESS.toLowerCase(),
]);

const CANONICAL_NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

function isNativeAddress(address: string | undefined): boolean {
    return NATIVE_ADDRESS_ALIASES.has(String(address ?? '').trim().toLowerCase());
}

/**
 * Identity of a holding for dedupe and cross-refetch matching. Native rows
 * collapse onto one address so an alias change between fetches cannot make a
 * coin look like two different tokens.
 *
 * Keys only — the row's own `address` is left untouched, because Solana's
 * native row must keep its real mint for the send/swap paths.
 */
function canonicalAddress(address: string | undefined): string {
    return isNativeAddress(address)
        ? CANONICAL_NATIVE_ADDRESS
        : String(address ?? '').toLowerCase();
}

// MUST use the canonical form: keying on the raw address let a native row
// whose alias changed between refetches miss its own previous entry, so the
// grace pass carried the old row forward *alongside* the new one — the wallet
// then listed BNB twice, same balance, one row holding a stale price.
const tokenRowKey = (t: any) => `${t.chainId}-${canonicalAddress(t.address)}`;

/**
 * (1) Drop every unpriced non-native token. A holding we cannot put a dollar
 *     value on is points/airdrop junk — "Berachain Point", "Grass Point",
 *     "DTX Point" and friends, all at $0.00. A real holding gets a price from
 *     the per-chain registry, however small (TREE at $0.83 stays).
 *
 *     Skipped entirely when NOTHING priced: that means the price service
 *     hiccuped, not that the wallet is full of junk, and wiping the list on a
 *     transient outage is worse than showing it briefly unpriced.
 *
 * (2) Carry forward holdings missing from this fetch for MISSING_GRACE_CYCLES
 *     with their last known price, so one dead source — or one failed price
 *     lookup on an otherwise real token — can't blank a chain.
 */
function applyStabilityGrace(tokens: any[], walletKey: string): any[] {
    const pricingWorked = tokens.some((t) => parseFloat(t.usdValue || '0') > 0);

    let out = pricingWorked
        ? tokens.filter(
            (t) => parseFloat(t.usdValue || '0') > 0
                || isNativeAddress(t.address)
                // A wrapped native (WBNB/WETH/WPOL/…) is the native coin by
                // another name — never points junk. If the price registry has
                // no quote for the wrapper on some long-tail chain, show the
                // holding unpriced rather than deleting it.
                || isKnownWrappedNative(t.chainId, t.address),
        )
        : tokens;

    const fresh = new Set(out.map(tokenRowKey));
    const carried: any[] = [];
    for (const old of lastGoodTokens.get(walletKey) || []) {
        const rk = tokenRowKey(old);
        const k = `${walletKey}|${rk}`;
        if (fresh.has(rk)) {
            missingStrikes.delete(k);
            continue;
        }
        const strikes = (missingStrikes.get(k) || 0) + 1;
        if (strikes >= MISSING_GRACE_CYCLES) {
            missingStrikes.delete(k);
            continue;
        }
        missingStrikes.set(k, strikes);
        carried.push({ ...old, isStale: true });
    }

    out = carried.length ? [...out, ...carried] : out;
    lastGoodTokens.set(walletKey, out);
    return out;
}

function filterToken(b: any): boolean {
    const usdValue = parseFloat(b.usdValue || '0');
    const balance = parseFloat(b.balanceFormatted || b.balance || '0');
    const symbol = (b.symbol || '').toUpperCase();
    const name = (b.name || '').toLowerCase();
    const addr = b.address?.toLowerCase() || '';

    if (balance <= 0.000001) return false;
    if (BLACKLISTED_SYMBOLS.includes(symbol)) return false;
    if (/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(name) || /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(symbol)) return false;
    // Phishing patterns first, exactly like the web app \u2014 before the sacred
    // whitelist, so "USDT \u00b7 visit claim.xyz" can't ride in on its symbol.
    if (isLikelySpamToken(b)) return false;
    // Reject tokens on chains we don't support — these would render with
    // an "Unknown" chain label and are almost always airdrop spam.
    const chainIdNum = Number(b.chainId);
    if (!chainIdNum || !KNOWN_CHAIN_IDS.has(chainIdNum)) return false;

    // Native symbol-to-chain enforcement — reject tokens where the symbol
    // is a native asset but the chainId doesn't match. Prevents "TON" appearing
    // on BSC or "BNB" appearing on TON.
    const allowedChainsForNative = nativeHomeChains(symbol);
    if (allowedChainsForNative && !allowedChainsForNative.includes(chainIdNum)) {
        return false;
    }

    // A canonical wrapped native is authoritative by address — it IS the
    // contract the impersonation guard below would check against. Must come
    // first: WETH/WBNB/WAVAX/WMATIC are in IMPERSONATED_STABLES, and on any
    // chain missing from OFFICIAL_STABLE_ADDRESSES the guard would mark the
    // real wrapper "unchecked" and then drop it whenever it went unpriced.
    if (isKnownWrappedNative(chainIdNum, addr)) return true;

    // Airdrop impersonation guard — a token claiming to be USDC/USDT/
    // DAI/etc. MUST be at the real contract address for its chain.
    // Everything else is the fake-stablecoin scam with a bogus price
    // feed (e.g. "0.744 USDC = $744,000"). Must be before SACRED_SYMBOLS
    // or the scam slips through via the symbol whitelist.
    let impersonationUnchecked = false;
    if (IMPERSONATED_STABLES.has(symbol)) {
        const officialAddr = OFFICIAL_STABLE_ADDRESSES[chainIdNum]?.[symbol]?.toLowerCase();
        if (officialAddr) {
            if (addr !== officialAddr) return false;
        } else {
            // No official-address table for this chain — we now surface every
            // chain in the registry, so most long-tail chains land here. A
            // genuine stablecoin trades inside its peg band, so an implausible
            // price is the fake-USDC tell; an ABSENT price proves nothing, and
            // normalizeToken would go on to force it to $1 (turning 1,000,000
            // fake USDC into "$1,000,000"). Only a peg-band price keeps the
            // SACRED_SYMBOLS free pass — everything else has to earn its place
            // through the quality gate below.
            const price = parseFloat(b.priceUSD || '0');
            const pegged = PEGGED_STABLES.has(symbol);
            if (pegged && price > 0 && (price < 0.5 || price > 2)) return false;
            if (!pegged || price <= 0) impersonationUnchecked = true;
        }
    }

    const isTWC = symbol === 'TWC' || addr === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
    const isNativeHolding = b.native_token === true
        || (isNativeAddress(addr) && !!allowedChainsForNative?.includes(chainIdNum));
    const trustedByIdentity = isNativeHolding || isKnownWrappedNative(chainIdNum, addr) || isTWC;
    const hasSourceTrust = hasVerifiedSourceSignal(b) || hasMarketActivitySignal(b);

    // Auto-discovery catches spam airdrops before the user asks for them. The
    // rows in the screenshot (SpaceXcoin/DOG/PEPETO/tiny fake-stable dust) all
    // share this shape: non-native, non-core, untrusted, and worth fractions of
    // a cent. Hide them before the sacred-symbol pass so dust USDC-style rows
    // do not clutter the wallet or inflate totals by tiny amounts.
    if (!trustedByIdentity && usdValue > 0 && usdValue < DUST_TOKEN_USD_CEILING) return false;

    if (!impersonationUnchecked && (SACRED_SYMBOLS.includes(symbol) || SACRED_ADDRESSES.includes(addr))) return true;

    if (isTWC) return true;

    // A stablecoin impersonator on a chain with no official-address table has
    // to at least carry a price — normalizeToken would otherwise peg it to $1
    // and a million fake USDC would land in the total.
    if (impersonationUnchecked && usdValue <= 0) return false;

    if (!trustedByIdentity && isExplicitlyUnverified(b) && !hasSourceTrust) return false;
    if (!trustedByIdentity && !hasSourceTrust && usdValue > 0 && usdValue < UNVERIFIED_TOKEN_USD_CEILING) return false;

    const chg = parseFloat(b.priceChange24h || '0');
    if (Math.abs(chg) > 10000) return false;
    if (SPAM_KEYWORDS.some(k => name.includes(k) || symbol.toLowerCase().includes(k))) return false;
    if (addr && /^(.)\1{3}$/.test(addr.replace('0x', '').slice(-4))) return false;
    if (b.possible_spam === true) return false;

    // Broad value thresholds stay out of this final gate. The only value-based
    // checks above are narrow dust/unverified guards for auto-discovered spam;
    // priced, trusted long-tail holdings still survive to applyStabilityGrace.
    return true;
}

// URLs from sources known to be unreliable or dead — skip them so we
// fall through to Koin Gallery / DexScreener instead.
function isUnreliableLogo(url?: string): boolean {
    if (!url) return true;
    if (url.includes('/placeholder/')) return true;
    if (url.includes('nexxend.xyz')) return true;
    return false;
}

// Stablecoins always peg to $1 — override any wrong backend price
const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDP', 'GUSD', 'LUSD', 'FDUSD']);

function normalizeToken(b: any) {
    const sym = (b.symbol || '').toUpperCase();
    const apiLogo = !isUnreliableLogo(b.logoURI) ? b.logoURI
        : !isUnreliableLogo(b.logo) ? b.logo
        : undefined;
    const adminLogo = getAdminTokenLogo(b.address, b.chainId);
    const providerLogo = normalizeTokenLogoUrl(apiLogo);

    const balance = parseFloat(b.balanceFormatted || b.balance || '0');
    let usdValue = b.usdValue || '0';
    let priceUSD = b.priceUSD || '0';

    // Fix stablecoin pricing — they should always be ~$1.00
    // If the backend returns a price <$0.50 or >$2 for a verified stablecoin, override to $1.
    if (STABLECOIN_SYMBOLS.has(sym) && balance > 0) {
        const reportedPrice = parseFloat(priceUSD);
        if (!reportedPrice || reportedPrice < 0.5 || reportedPrice > 2) {
            priceUSD = '1';
            usdValue = balance.toFixed(4);
        }
    }

    return {
        ...b,
        // WSOL is the wrapped-SOL SPL token, not native SOL. Relabelling it "SOL"
        // both mislabelled the holding and collided with native SOL on the swap
        // sheet's chain+symbol dedupe key, hiding one of the two.
        symbol: b.symbol,
        name: b.name || b.symbol || 'Unknown',
        logoURI: adminLogo || providerLogo || getTokenLogo(b.symbol, b.chainId, b.address),
        balanceFormatted: b.balanceFormatted || b.balance || '0',
        usdValue,
        priceUSD,
        priceChange24h: parseFloat(b.priceChange24h || '0'),
    };
}

async function fetchCustomTokenRows(args: {
    customTokens: CustomToken[];
    evmAddr?: string;
    solAddr?: string;
    walletKey: string;
    updateTokenBalance: ReturnType<typeof useCustomTokenStore.getState>['updateTokenBalance'];
}) {
    const { customTokens, evmAddr, solAddr, walletKey, updateTokenBalance } = args;
    const rows: any[] = [];

    for (const ct of customTokens) {
        if (ct.hidden) continue;
        let balanceInfo: { balance?: string; balanceFormatted: string; decimals?: number } | null = null;

        if (ct.chainId === 7565164) {
            if (!solAddr) continue;
            const bal = await fetchSolanaTokenBalance(ct.address, solAddr);
            if (bal !== null) balanceInfo = { balanceFormatted: bal, decimals: ct.decimals };
        } else {
            if (!evmAddr || !isEvmAddress(evmAddr)) continue;
            const evm = await fetchEvmTokenBalanceDetails(ct.chainId, ct.address, evmAddr);
            if (evm) balanceInfo = evm;
        }

        if (!balanceInfo) continue;

        let priceUSD = ct.priceUSD || '0';
        let logoURI = ct.logoURI;
        let symbol = ct.symbol;
        let name = ct.name;
        try {
            const info = await api.tokenInfo.get(ct.chainId, ct.address);
            if (info?.pool?.priceUsd != null) priceUSD = String(info.pool.priceUsd);
            if (info?.token?.symbol && info.token.symbol !== 'UNKNOWN') symbol = info.token.symbol;
            if (info?.token?.name && info.token.name !== 'Unknown Token') name = info.token.name;
            logoURI = resolveTokenLogo({
                address: ct.address,
                chainId: ct.chainId,
                logoURI: info?.token?.logo || logoURI,
            }) || logoURI;
        } catch {
            logoURI = getAdminTokenLogo(ct.address, ct.chainId) || normalizeTokenLogoUrl(logoURI);
        }

        const balanceFormatted = String(balanceInfo.balanceFormatted || '0');
        const usdValue = (parseFloat(balanceFormatted) * parseFloat(priceUSD || '0')).toFixed(6);
        const decimals = balanceInfo.decimals ?? ct.decimals;

        if (
            balanceFormatted !== ct.balanceFormatted ||
            usdValue !== ct.usdValue ||
            priceUSD !== ct.priceUSD ||
            decimals !== ct.decimals ||
            symbol !== ct.symbol ||
            name !== ct.name ||
            logoURI !== ct.logoURI
        ) {
            updateTokenBalance(walletKey, ct.address, ct.chainId, {
                balanceFormatted,
                usdValue,
                priceUSD,
                symbol,
                name,
                logoURI,
                decimals,
            });
        }

        if (parseFloat(balanceFormatted || '0') <= 0) continue;

        rows.push({
            address: ct.address,
            chainId: ct.chainId,
            symbol,
            name,
            decimals,
            logoURI,
            balance: balanceInfo.balance || balanceFormatted,
            balanceFormatted,
            usdValue,
            priceUSD,
            priceChange24h: 0,
            isCustom: true,
        });
    }

    return rows;
}

function mergeCustomRows(tokens: any[], customRows: any[]) {
    if (customRows.length === 0) return tokens;
    const out = [...tokens];

    for (const row of customRows) {
        const key = tokenRowKey(row);
        const index = out.findIndex((t) => tokenRowKey(t) === key);
        if (index >= 0) {
            const existing = out[index];
            const priceUSD = row.priceUSD || existing.priceUSD || '0';
            const usdValue = parseFloat(row.usdValue || '0') > 0
                ? row.usdValue
                : (parseFloat(row.balanceFormatted || '0') * parseFloat(priceUSD || '0')).toFixed(6);
            out[index] = {
                ...existing,
                ...row,
                logoURI: row.logoURI || existing.logoURI,
                priceUSD,
                usdValue,
                priceChange24h: existing.priceChange24h || row.priceChange24h || 0,
            };
        } else {
            out.push(row);
        }
    }

    return out;
}

export function useWalletBalances() {
    const { activeAddress, activeGroupId, walletGroups, _hasHydrated, cachedBalances, setCachedBalances } = useWalletStore();
    const selectedChains = useFilterStore((state) => state.chains);
    const tokensByWallet = useCustomTokenStore((state) => state.tokensByWallet);
    const updateCustomTokenBalance = useCustomTokenStore((state) => state.updateTokenBalance);

    // An explicit chain filter narrows DISCOVERY too (fewer RPC sweeps); with no
    // filter we sweep everything — the chain chips in the wallet screen filter
    // the rendered list locally, so clamping discovery here would permanently
    // hide long-tail holdings.
    const chainIdsForFetch = useMemo(() => {
        if (selectedChains.size > 0) {
            return Array.from(selectedChains).map(Number).filter(n => !isNaN(n));
        }
        return [] as number[];
    }, [selectedChains]);

    const group = useMemo(() => walletGroups.find(g => g.id === activeGroupId), [walletGroups, activeGroupId]);
    const walletKey = activeGroupId || activeAddress || 'default';
    const customTokens = useMemo(() => tokensByWallet[walletKey] || [], [tokensByWallet, walletKey]);
    const customTokenIdentityKey = useMemo(
        () => customTokens
            .map(t => `${t.chainId}:${t.address.toLowerCase()}:${t.hidden ? 'hidden' : 'shown'}`)
            .sort()
            .join('|'),
        [customTokens],
    );

    // Cache key for this wallet. The version suffix invalidates every snapshot
    // written by an older balance pipeline — otherwise the app opens showing a
    // stale, far thinner token list from disk. Bump it whenever the discovery
    // or filtering behaviour changes materially.
    // v4: stricter auto-discovered spam/dust filtering, so every v3 snapshot
    // on disk can still contain rows the wallet now blocks.
    const cacheKey = `${activeAddress}-${activeGroupId}-v4`;
    const cached = cachedBalances[cacheKey];

    return useQuery({
        queryKey: ['walletBalances', activeAddress, activeGroupId, chainIdsForFetch, customTokenIdentityKey],
        queryFn: async () => {
            if (!_hasHydrated || !activeAddress) {
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }

            try {
                const evmAddr = group?.addresses?.EVM;
                const solAddr = group?.addresses?.SOLANA;
                const tronAddr = group?.addresses?.TRON;

                // ── 1. Discovery: one server-side aggregation call ──
                // /api/v1/mobile/portfolio fans out to EVERY balance source the
                // web app uses — Nexxend majors plus the long-tail
                // *-direct-balances readers across EVM (~50 chains), Cosmos,
                // Solana, Tron, TON, Sui, Aptos, Bitcoin, Starknet, Polkadot,
                // the UTXO chains and Stacks — then merges + reprices them
                // through the accurate per-chain price registry. The legacy
                // per-address Nexxend + Moralis path below is kept as a fallback
                // so a route outage never blanks the portfolio.
                let rawBalances: any[] = [];
                let portfolioFailed = false;
                try {
                    const resp = await api.portfolio.get({
                        addresses: portfolioAddressesFor(group),
                        chains: chainIdsForFetch,
                    }) as any;
                    rawBalances = Array.isArray(resp?.balances) ? resp.balances : [];
                    // A 200 with nothing in it means every upstream source
                    // degraded — treat it like an outage so the on-device
                    // readers below still surface the user's native balances.
                    if (rawBalances.length === 0) portfolioFailed = true;
                } catch (portfolioErr: any) {
                    portfolioFailed = true;
                    console.warn('[useWalletBalances] portfolio route failed, falling back to Nexxend/Moralis:', portfolioErr?.message);

                    // ── Fallback: EVM + Solana + TRON in parallel ──
                    const fallbackChains = chainIdsForFetch.length ? chainIdsForFetch : FALLBACK_CHAIN_IDS;
                    const [evmResult, solResult, tronResult] = await Promise.all([
                        (async () => {
                            if (!evmAddr || !isEvmAddress(evmAddr)) return { balances: [] as any[] };
                            try {
                                const resp = await api.wallet.balances({
                                    address: evmAddr,
                                    chains: fallbackChains,
                                }) as any;
                                return {
                                    balances: Array.isArray(resp?.balances)
                                        ? resp.balances
                                        : (Array.isArray(resp) ? resp : []),
                                };
                            } catch {
                                try {
                                    const moralisTokens = await moralisService.getWalletBalances(evmAddr, fallbackChains);
                                    return { balances: moralisTokens };
                                } catch {
                                    return { balances: [] as any[] };
                                }
                            }
                        })(),
                        (async () => {
                            if (!solAddr) return { balances: [] as any[] };
                            try {
                                const resp = await api.wallet.balances({ address: solAddr, chains: [7565164] }) as any;
                                return { balances: Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []) };
                            } catch { return { balances: [] as any[] }; }
                        })(),
                        (async () => {
                            if (!tronAddr) return { balances: [] as any[] };
                            try {
                                const resp = await api.wallet.balances({ address: tronAddr, chains: [728126428] }) as any;
                                return { balances: Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []) };
                            } catch { return { balances: [] as any[] }; }
                        })(),
                    ]);

                    rawBalances = [
                        ...evmResult.balances,
                        ...solResult.balances,
                        ...tronResult.balances,
                    ];
                }

                // ── 3b. On-device extra-chain natives (fallback only) ──
                // The portfolio route now covers Sui/Aptos/Injective/Bitcoin and
                // the whole Cosmos family server-side, so these ~15 on-device
                // RPC reads only run when that route is unreachable. Rows are
                // appended AFTER the server rows so dedup keeps the priced ones.
                if (portfolioFailed && group) {
                    const extraBalances = await fetchExtraNativeBalances(group).catch((e) => {
                        console.warn('[useWalletBalances] extra-chain balances failed:', e?.message);
                        return [] as any[];
                    });
                    if (extraBalances.length) rawBalances = [...rawBalances, ...extraBalances];
                }

                // ── 4. Deduplicate ──
                // Repair Solana identity FIRST: a lamport balance reported under
                // the wrapped-SOL mint (older backend builds do this) would
                // otherwise render as "WSOL" and share a dedupe key with a real
                // WSOL token account.
                rawBalances = rawBalances.map(normalizeSolanaBalanceRow);

                const dedupedMap = new Map<string, any>();
                rawBalances.forEach(b => {
                    if (!b) return;
                    // Key on (chain, contract) ONLY. Including the symbol let two
                    // rows for the same contract survive when sources spelled the
                    // name differently — they then rendered twice and collided on
                    // the list's `${chainId}-${address}` React key ("Encountered
                    // two children with the same key"). Same key the web app uses.
                    // `canonicalAddress` is shared with tokenRowKey so a row keeps
                    // one identity from dedupe through the cross-refetch grace.
                    const key = tokenRowKey(b);
                    const existing = dedupedMap.get(key);
                    // Prefer the priced row when a duplicate does arrive.
                    if (!existing || parseFloat(b.usdValue || '0') > parseFloat(existing.usdValue || '0')) {
                        dedupedMap.set(key, b);
                    }
                });

                // ── 5. Filter spam + normalize ──
                // Admin-uploaded logos are tiny and contract-keyed; load them
                // before row normalization so portfolio and picker icons agree.
                await ensureAdminTokenLogoOverrides().catch(() => {});
                // Fire broad logo cache warming in background — don't block balance render
                ensureTokenLogos().catch(() => {});
                // ── 5b. Cross-refetch grace (web parity) ──
                // filterToken keeps every non-spam holding; this pass is what
                // finally retires a token — after 4 consecutive $0 fetches —
                // and carries a briefly-missing one forward for 3 cycles so a
                // timed-out source never blanks a chain.
                let tokens = applyStabilityGrace(
                    Array.from(dedupedMap.values())
                        .filter(filterToken)
                        .map(normalizeToken),
                    cacheKey,
                );
                const customRows = await fetchCustomTokenRows({
                    customTokens,
                    evmAddr,
                    solAddr,
                    walletKey,
                    updateTokenBalance: updateCustomTokenBalance,
                });
                tokens = mergeCustomRows(tokens, customRows);

                // ── 6. Portfolio metrics ──
                // Always compute from the FILTERED token list so any spam
                // token we dropped (fake USDC, fake USDT, etc.) cannot
                // pollute the total balance card. The backend's pre-summed
                // `totalUSD` / `dailyChange` fields are deliberately
                // ignored here — they'd carry the spam value forward even
                // after the client filter removed the offending row.
                let totalNetWorthUsd: string;
                let portfolioChangeAmount: string;
                let portfolioChangePercent: string;

                const totalUsdToday = tokens.reduce((sum, t) => sum + parseFloat(t.usdValue || '0'), 0);
                let totalUsdYesterday = 0;
                let totalGainUsd = 0;

                tokens.forEach((token) => {
                    const valToday = parseFloat(token.usdValue || '0');
                    const chg = token.priceChange24h || 0;
                    if (valToday > 0) {
                        const safeChange = Math.max(chg, -99.99);
                        const valYesterday = valToday / (1 + safeChange / 100);
                        totalUsdYesterday += valYesterday;
                        totalGainUsd += (valToday - valYesterday);
                    }
                });

                const pctChange = totalUsdYesterday > 0 ? (totalGainUsd / totalUsdYesterday) * 100 : 0;

                // Preserve sub-cent precision — `.toFixed(2)` would turn a
                // real balance of $0.000958 into the string "0.00", which
                // the Total Balance card then displays as $0.00 even
                // though the user actually holds something. The formatter
                // (currencyService.format) handles the display rounding.
                totalNetWorthUsd = totalUsdToday.toFixed(8);
                portfolioChangeAmount = totalGainUsd.toFixed(8);
                portfolioChangePercent = pctChange.toFixed(2);

                const sortedTokens = tokens.sort((a, b) => parseFloat(b.usdValue) - parseFloat(a.usdValue));

                // Defer notification side-effects off the critical path so
                // React can render the fresh balances immediately. These
                // are fire-and-forget and must never block the return.
                Promise.resolve().then(() => {
                    notificationService.checkPriceAlerts(sortedTokens);
                    if (activeAddress) {
                        notificationService.syncWatchedTokens(activeAddress, sortedTokens);
                    }
                });

                const result = {
                    tokens: sortedTokens,
                    totalNetWorthUsd,
                    portfolioChange: {
                        amount: portfolioChangeAmount,
                        percent: portfolioChangePercent,
                    },
                };

                // Persist to disk for instant load on next app open
                setCachedBalances(cacheKey, result);

                return result;
            } catch (error) {
                console.error('[useWalletBalances] Error:', error);
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }
        },
        enabled: _hasHydrated && !!activeAddress,
        staleTime: 1000 * 60 * 3,
        gcTime: 1000 * 60 * 15,
        // MUST be true. `initialData` paints the snapshot persisted to disk, and
        // `initialDataUpdatedAt` marks it stale — but with refetchOnMount:false
        // that staleness went nowhere, so opening the app re-rendered the old
        // snapshot and NEVER refetched. Balances only updated on pull-to-refresh,
        // which is why a reload after a backend change appeared to do nothing.
        // `true` refetches on mount only when stale, so staleTime still throttles.
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Show persisted balance instantly, then refresh in background
        initialData: cached ? {
            tokens: cached.tokens,
            totalNetWorthUsd: cached.totalNetWorthUsd,
            portfolioChange: cached.portfolioChange,
        } : undefined,
        // Mark persisted data as stale so it triggers a background refresh
        initialDataUpdatedAt: cached?.updatedAt,
        placeholderData: keepPreviousData,
        structuralSharing: true,
    });
}
