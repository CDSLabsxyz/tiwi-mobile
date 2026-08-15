import { api, type SwapDefaultToken, type TokenItem } from '@/lib/mobile/api-client';
import { registerAdminTokenLogoOverrides, resolveTokenLogo } from '@/utils/admin-token-logos';

/**
 * Market rows → swappable tokens.
 *
 * `/api/v1/market/list` is an aggregate feed (CMC / CoinGecko / BlockMarketScan).
 * Every row it returns carries `address` = the provider's *slug* ("bitcoin",
 * "usd-coin") and `chainId` = 1, regardless of where the asset actually lives -
 * only TWC is patched server-side with its real BSC contract. So a market row
 * cannot be handed to the swap engine as-is: `{address:"bitcoin", chainId:1}` is
 * a ghost token that fails every balance read, quote and approval.
 *
 * This module resolves such a row to a real (chainId, contract) pair using two
 * sources, scored together:
 *   1. `/api/v1/swap-default-tokens` - the admin-curated allow-list. Trusted,
 *      carries real decimals, and is one cached request.
 *   2. `/api/v1/tokens?query=SYMBOL`  - the raw index. Much wider coverage but
 *      spam-ridden, so candidates must survive symbol + price sanity checks.
 *
 * Rows that already carry a real on-chain address (Spotlight / Listing entries,
 * TWC, search results) skip resolution entirely.
 */

/** A market/spotlight row, in any of the shapes the app passes around. */
export interface MarketTokenLike {
    id?: string;
    symbol: string;
    displaySymbol?: string;
    name?: string;
    address?: string | null;
    chainId?: number | null;
    price?: string | number | null;
    priceUSD?: string | number | null;
    logo?: string | null;
    logoURI?: string | null;
}

export interface ResolvedSwapToken {
    chainId: number;
    address: string;
    symbol: string;
    name: string;
    decimals?: number;
    logoURI?: string;
    priceUSD?: string;
    liquidity?: number;
}

// ─── Address shapes ──────────────────────────────────────────────────────────

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** Sui / Aptos / Starknet object & resource ids. */
const LONG_HEX_ADDRESS = /^0x[0-9a-fA-F]{63,66}$/;
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const COSMOS_DENOM = /^(ibc\/[A-F0-9]{64}|factory\/[^/]+\/.+|[a-z]+1[a-z0-9]{38,})$/;
/** TON raw/friendly addresses. */
const TON_ADDRESS = /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/;
/** Aptos fungible-asset / coin type paths, e.g. `0x1::aptos_coin::AptosCoin`. */
const MOVE_TYPE = /^0x[0-9a-fA-F]+::[A-Za-z0-9_]+::[A-Za-z0-9_]+$/;

/** A CoinGecko/CMC slug: lowercase words joined by hyphens ("usd-coin"). */
const PROVIDER_SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/;

/**
 * Whether `address` is something the swap engine can actually use.
 *
 * The zero address and the literal `native` both count - those are how the app
 * spells a chain's own coin (see `isNativeToken` in utils/wallet). Provider
 * slugs are rejected first: they are the exact thing this module exists to
 * replace, and a long hyphen-free slug could otherwise sneak past base58.
 */
export function isRealTokenAddress(address?: string | null): boolean {
    const addr = (address || '').trim();
    if (!addr) return false;
    if (addr.toLowerCase() === 'native') return true;
    if (PROVIDER_SLUG.test(addr)) return false;
    // Bare provider slugs with no separator ("bitcoin", "solana", "tether").
    if (/^[a-z]{3,20}$/.test(addr)) return false;
    return (
        EVM_ADDRESS.test(addr) ||
        LONG_HEX_ADDRESS.test(addr) ||
        MOVE_TYPE.test(addr) ||
        TRON_ADDRESS.test(addr) ||
        TON_ADDRESS.test(addr) ||
        COSMOS_DENOM.test(addr) ||
        BASE58_ADDRESS.test(addr)
    );
}

/** Canonical spelling of a chain's own coin, as the rest of the app expects. */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function isNativeAddress(address: string): boolean {
    const lower = address.toLowerCase();
    return lower === 'native' || lower === ZERO_ADDRESS;
}

function normalizeAddress(address: string): string {
    return address.toLowerCase() === 'native' ? ZERO_ADDRESS : address;
}

// ─── Scoring inputs ──────────────────────────────────────────────────────────

/**
 * Chains we route through most reliably, best first, and the dominant term in
 * the ranking. Symbol and price already establish that the surviving candidates
 * are the *same asset*; what's left to decide is where the user can trade it,
 * and that's the chain. Anything off this list scores zero here.
 */
const CHAIN_PRIORITY = [56, 1, 8453, 42161, 137, 10, 43114, 7565164, 728126428, 1100, 25, 250, 59144, 534352, 146];

/** UTXO chains have no swap venue here; only pick them when nothing else fits. */
const UTXO_CHAINS = new Set([8332, 22555, 8338, 20443, 16110, 8114]);

/** Wrapped / bridged spellings of the same asset (BTC → WBTC, BTCB, BTC.b…). */
function symbolVariants(symbol: string): string[] {
    const s = symbol.toUpperCase();
    return [s, `W${s}`, `${s}B`, `${s}.B`, `${s}.E`, `AXL${s}`, `CB${s}`, `${s}.AXL`, `M.${s}`];
}

function parsePrice(value: unknown): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Strip CEX pair suffixes so `TWC-USDT` / `BTC/USDT` resolve as the base asset. */
function baseSymbol(token: MarketTokenLike): string {
    const raw = (token.displaySymbol || token.symbol || '').toUpperCase();
    return raw.split('-')[0].split('/')[0].trim();
}

// ─── Curated list (cached across the app session) ────────────────────────────

const CURATED_TTL_MS = 5 * 60 * 1000;
let curatedCache: { tokens: SwapDefaultToken[]; expiry: number } | null = null;
let curatedInFlight: Promise<SwapDefaultToken[]> | null = null;

async function getCuratedTokens(signal?: AbortSignal): Promise<SwapDefaultToken[]> {
    if (curatedCache && curatedCache.expiry > Date.now()) return curatedCache.tokens;
    if (curatedInFlight) return curatedInFlight;

    curatedInFlight = api.tokens
        .swapDefaults({ signal })
        .then((resp) => {
            const tokens = resp.tokens || [];
            registerAdminTokenLogoOverrides(tokens);
            curatedCache = { tokens, expiry: Date.now() + CURATED_TTL_MS };
            return tokens;
        })
        .catch(() => [] as SwapDefaultToken[])
        .finally(() => {
            curatedInFlight = null;
        });

    return curatedInFlight;
}

// ─── Candidate scoring ───────────────────────────────────────────────────────

interface Candidate extends ResolvedSwapToken {
    score: number;
}

interface ScoringContext {
    /** Chain ids from the registry. Candidates elsewhere can't be selected. */
    supportedChainIds: Set<number> | null;
    /** chainId → its native coin's ticker, so SOL lands on Solana, TRX on TRON. */
    nativeSymbolByChain: Map<number, string>;
}

/**
 * Score one candidate against the market row. Returns null when the candidate
 * is disqualified - a different asset that merely shares a ticker.
 *
 * Symbol and price act as the *gate* ("is this the same asset?"); the chain is
 * what mostly decides the *ranking*. Once price has confirmed that BTC-on-Merlin,
 * BTCB-on-BSC and WBTC-on-Ethereum are all bitcoin, the only question left is
 * where the user can actually trade it.
 */
function scoreCandidate(
    candidate: {
        chainId: number;
        address: string;
        symbol: string;
        name?: string | null;
        decimals?: number | null;
        logoURI?: string | null;
        priceUSD?: string | number | null;
        liquidity?: number | null;
        verified?: boolean;
    },
    target: { symbol: string; name: string; price: number },
    ctx: ScoringContext,
    curated: boolean,
): Candidate | null {
    const chainId = Number(candidate.chainId);
    if (!Number.isFinite(chainId) || chainId <= 0) return null;
    if (ctx.supportedChainIds && ctx.supportedChainIds.size > 0 && !ctx.supportedChainIds.has(chainId)) return null;

    const address = (candidate.address || '').trim();
    if (!isRealTokenAddress(address)) return null;

    const candSymbol = (candidate.symbol || '').toUpperCase();
    const variantIndex = symbolVariants(target.symbol).indexOf(candSymbol);
    if (variantIndex === -1) return null;

    // Price sanity is the strongest signal we have against ticker squatters
    // ("HarryPotterObamaPacMan8Inu" trades as XRP on Ethereum). Only applied
    // when both sides have a price - an unpriced index row is merely unranked,
    // never rejected.
    const candPrice = parsePrice(candidate.priceUSD);
    let priceScore = 0;
    if (target.price > 0 && candPrice > 0) {
        const ratio = candPrice / target.price;
        if (ratio < 0.87 || ratio > 1.15) return null;
        priceScore = ratio >= 0.98 && ratio <= 1.02 ? 25 : 15;
    }

    let score = priceScore;

    const priorityIndex = CHAIN_PRIORITY.indexOf(chainId);
    if (priorityIndex > -1) score += 100 - priorityIndex * 4;
    if (UTXO_CHAINS.has(chainId)) score -= 40;

    // The asset's own chain, when we route there well: SOL→Solana, TRX→TRON,
    // ETH→Ethereum. Deliberately withheld from chains outside the priority list
    // so an obscure L2 that happens to use the ticker as gas (BTC on Merlin)
    // doesn't outrank the liquid wrapper on BSC.
    if (
        priorityIndex > -1 &&
        isNativeAddress(address) &&
        ctx.nativeSymbolByChain.get(chainId) === target.symbol
    ) {
        score += 60;
    }

    if (variantIndex === 0) score += 40;

    if (target.name) {
        const candName = (candidate.name || '').toLowerCase();
        const targetName = target.name.toLowerCase();
        if (candName === targetName) score += 25;
        else if (candName.includes(targetName) || targetName.includes(candName)) score += 20;
    }

    if (curated) score += 20;
    if (candidate.verified) score += 5;

    return {
        score,
        chainId,
        address: normalizeAddress(address),
        symbol: candidate.symbol,
        name: candidate.name || candidate.symbol,
        decimals: candidate.decimals ?? undefined,
        logoURI: candidate.logoURI ?? undefined,
        priceUSD: candPrice > 0 ? String(candPrice) : undefined,
        liquidity: candidate.liquidity ?? undefined,
    };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ResolveOptions {
    /** The chain registry (`useChains()`). Candidates elsewhere are dropped. */
    chains?: Array<{ id: number; nativeCurrency?: { symbol: string } | null }>;
    signal?: AbortSignal;
}

/**
 * Resolve a market/spotlight row to a token the swap engine can quote.
 *
 * Returns null when the asset has no on-chain representation we can route
 * (XMR, PI, most RWA funds) - callers should tell the user rather than seeding
 * a token that will fail at quote time.
 */
export async function resolveMarketToken(
    token: MarketTokenLike,
    options: ResolveOptions = {},
): Promise<ResolvedSwapToken | null> {
    const registry = options.chains || [];
    const ctx: ScoringContext = {
        supportedChainIds: registry.length ? new Set(registry.map((c) => Number(c.id))) : null,
        nativeSymbolByChain: new Map(
            registry
                .filter((c) => c.nativeCurrency?.symbol)
                .map((c) => [Number(c.id), c.nativeCurrency!.symbol.toUpperCase()] as const),
        ),
    };

    // Fast path - the row already knows its own contract (Spotlight/Listing
    // entries, TWC, token-index search results).
    const ownAddress = (token.address || '').trim();
    const ownChainId = Number(token.chainId);
    if (
        isRealTokenAddress(ownAddress) &&
        Number.isFinite(ownChainId) &&
        ownChainId > 0 &&
        (!ctx.supportedChainIds || ctx.supportedChainIds.has(ownChainId))
    ) {
        return {
            chainId: ownChainId,
            address: normalizeAddress(ownAddress),
            symbol: token.symbol,
            name: token.name || token.symbol,
            logoURI: resolveTokenLogo(token),
            priceUSD: token.priceUSD != null ? String(token.priceUSD) : token.price != null ? String(token.price) : undefined,
        };
    }

    const symbol = baseSymbol(token);
    if (!symbol) return null;

    const target = {
        symbol,
        name: (token.name || '').trim(),
        price: parsePrice(token.priceUSD ?? token.price),
    };

    const [curated, indexed] = await Promise.all([
        getCuratedTokens(options.signal),
        api.tokens
            // The index is fuzzy-matched and ranks by its own relevance, so the
            // right chain for a common ticker can sit well down the list - 50
            // is what it takes for e.g. ADA's BSC entry to show up reliably.
            .list({ query: symbol, limit: 50 }, { signal: options.signal })
            .then((resp) => resp.tokens || [])
            .catch(() => [] as TokenItem[]),
    ]);

    const candidates: Candidate[] = [];

    for (const t of curated) {
        // `address: null` / "PLACEHOLDER" marks a coming-soon stub in the
        // curated list - it renders in the selector but can't be routed.
        if (t.chainId == null || !t.address || t.address === 'PLACEHOLDER') continue;
        const scored = scoreCandidate(
            {
                chainId: t.chainId,
                address: t.address,
                symbol: t.symbol,
                name: t.name,
                decimals: t.decimals,
                logoURI: resolveTokenLogo(t),
            },
            target,
            ctx,
            true,
        );
        if (scored) candidates.push(scored);
    }

    for (const t of indexed) {
        const scored = scoreCandidate(t, target, ctx, false);
        if (scored) candidates.push(scored);
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // A curated hit wins on trust but carries no live price; if the index found
    // the very same token, merge its price/liquidity in so the swap card can
    // show a value immediately and the quote can skip a server-side lookup.
    const twin = candidates.find(
        (c) =>
            c !== best &&
            c.chainId === best.chainId &&
            c.address.toLowerCase() === best.address.toLowerCase(),
    );

    return {
        chainId: best.chainId,
        address: best.address,
        symbol: best.symbol,
        name: best.name,
        decimals: best.decimals ?? twin?.decimals,
        logoURI: resolveTokenLogo({
            address: best.address,
            chainId: best.chainId,
            logoURI: best.logoURI || twin?.logoURI || token.logoURI,
            logo: token.logo,
        }),
        priceUSD: best.priceUSD ?? twin?.priceUSD,
        liquidity: best.liquidity ?? twin?.liquidity,
    };
}
