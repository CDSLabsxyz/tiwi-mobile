/**
 * Token-picker list composition.
 *
 * Port of the web selector's list building
 * (tiwi-user-app/components/swap/token-selector-modal.tsx). Kept as a pure
 * function, separate from the sheet component, so it can be exercised against
 * live API payloads without rendering React.
 *
 * Two modes:
 *
 *   BROWSE (no search query) - wallet holdings, then the admin-curated
 *     `/api/v1/swap-default-tokens` list, then user-imported custom tokens.
 *     The raw `/api/v1/tokens` index is used only to enrich curated entries
 *     with live logo/price/market data and to top a single chain up to
 *     {@link CURATED_TARGET_PER_CHAIN} rows.
 *
 *   SEARCH - everything from the index that matches and survives isSpamToken,
 *     so any real token stays findable by symbol or pasted address.
 *
 * Browsing the raw index directly is what made the picker list "01", "100¥",
 * "1ART" and 赵长娥 on BSC while dropping BNB, USDT and USDC: the index marks
 * that junk `verified: true` and the majors `verified: false`, so a
 * `!verified && isCoreName` heuristic removes exactly the tokens a user wants
 * and keeps the noise. The curated list is the allow-list that fixes it.
 */

import type { SwapDefaultToken, TokenItem } from '@/lib/mobile/api-client';
import { getAdminTokenLogo, normalizeTokenLogoUrl, resolveTokenLogo } from '@/utils/admin-token-logos';
import { formatTokenQuantity, formatUSDPrice } from '@/utils/formatting';
import { isSpamToken } from '@/utils/token-spam';
import { MORALIS_NATIVE_ADDRESS, NATIVE_TOKEN_ADDRESS } from '@/utils/wallet';

/**
 * How many rows a single-chain browse aims to show. The curated list holds
 * ~5 headline tokens per chain; when a chain has fewer, the list tops up from
 * the index. Same target the web selector uses.
 */
export const CURATED_TARGET_PER_CHAIN = 5;

/** Chains whose tokens the index covers poorly, so activity substitutes for `verified`. */
const THIN_INDEX_CHAINS = [1100, 728126428, 118];

export interface TokenOption {
    id: string;
    symbol: string;
    name: string;
    icon: any;
    chainIcon?: any;
    tvl: string;
    balanceFiat: string;
    balanceToken: string;
    address: string;
    chainId: number;
    decimals: number;
    priceUSD?: string;
    /** Pair liquidity in USD - forwarded to the route API to skip a slow
     *  server-side DexScreener lookup on every quote. */
    liquidity?: number;
}

/** A wallet holding, as produced by useWalletBalances. */
export interface HeldToken {
    symbol: string;
    name?: string;
    address: string;
    chainId: number;
    decimals?: number;
    logoURI?: string;
    priceUSD?: string;
    balanceFormatted?: string;
}

/** A user-imported token from the custom-token store. */
export interface ImportedToken {
    symbol: string;
    name: string;
    address: string;
    chainId: number;
    decimals: number;
    logoURI?: string;
    priceUSD?: string;
    /** Last known balance. The custom-token store keeps its own copy - the
     *  balance sweep in useWalletBalances does not cover imported tokens. */
    balanceFormatted?: string;
    hidden?: boolean;
}

export interface BuildTokenOptionsInput {
    /** Raw `/api/v1/tokens` results for the current chain scope + query. */
    apiTokens: TokenItem[];
    /** Admin-curated `/api/v1/swap-default-tokens` entries. */
    curated: SwapDefaultToken[];
    /** Wallet holdings across every chain. */
    held: HeldToken[];
    /** User-imported tokens for the active wallet. */
    imported: ImportedToken[];
    /** `${chainId}-${lowercased address}` keys hidden via Manage Tokens. */
    hiddenKeys: Set<string>;
    /** Chain id → badge icon url. */
    chainIconFor: (chainId?: number) => string | undefined;
    /** Restrict to a single chain, or null to browse every chain. */
    chainId: number | null;
    searchQuery: string;
    /**
     * Show ONLY tokens the wallet actually holds (balance > 0).
     *
     * Used by the staking pool creator: a pool is funded out of the creator's
     * own balance, so offering tokens they don't hold is a dead end. Curated
     * defaults, the raw index and zero-balance rows are all suppressed -
     * including while searching, so the search box narrows the holdings
     * rather than reaching back into the index.
     */
    walletOnly?: boolean;
}

type Row = TokenOption & { usdValueNum: number; marketScore: number };

export function buildTokenOptions({
    apiTokens,
    curated,
    held,
    imported,
    hiddenKeys,
    chainIconFor,
    chainId,
    searchQuery,
    walletOnly = false,
}: BuildTokenOptionsInput): TokenOption[] {
    const hasSearch = searchQuery.trim().length > 0;
    const scopedChain = typeof chainId === 'number' ? chainId : null;

    const NATIVE_ADDRS = [NATIVE_TOKEN_ADDRESS, MORALIS_NATIVE_ADDRESS].map(a => a.toLowerCase());
    const inScope = (cid?: number) => scopedChain === null || cid === scopedChain;
    const isHidden = (cid?: number, addr?: string) =>
        hiddenKeys.has(`${cid}-${(addr || '').toLowerCase()}`);
    const addrKey = (cid?: number, addr?: string) => `${cid ?? 0}-${(addr || '').toLowerCase()}`;
    const symKey = (cid?: number | null, sym?: string) => `${(sym || '').toUpperCase()}-${cid ?? 0}`;
    const isNativeAddr = (addr?: string) => NATIVE_ADDRS.includes((addr || '').toLowerCase());

    const matchesSearch = (sym?: string, name?: string, addr?: string) => {
        if (!hasSearch) return true;
        const q = searchQuery.toLowerCase().trim();
        return (sym || '').toLowerCase().includes(q)
            || (name || '').toLowerCase().includes(q)
            || (addr || '').toLowerCase().includes(q);
    };

    // Index the raw API list so curated entries can borrow its live
    // logo / price / market data instead of rendering as bare stubs.
    const apiIndex = new Map(apiTokens.map(t => [addrKey(t.chainId, t.address), t]));

    // Imported tokens carry their own balance - useWalletBalances doesn't
    // sweep the custom-token store - so fold the ones with a balance into the
    // holdings set. Without this, a token the user imported AND holds renders
    // with a "0" balance, and disappears entirely in walletOnly mode.
    const heldIndex = new Map(held.map(h => [addrKey(h.chainId, h.address), h]));
    for (const ct of imported) {
        if (ct.hidden) continue;
        const key = addrKey(ct.chainId, ct.address);
        if (heldIndex.has(key)) continue;
        if (!(parseFloat(ct.balanceFormatted || '0') > 0)) continue;
        heldIndex.set(key, ct);
    }
    const holdings = [...heldIndex.values()];

    /** Build a display row. Balance columns come from the wallet when held. */
    const toRow = (t: {
        symbol: string; name?: string; address: string; chainId: number;
        decimals?: number; logoURI?: string; priceUSD?: string; liquidity?: number;
    }): Row => {
        const holding = heldIndex.get(addrKey(t.chainId, t.address));
        const balNum = parseFloat(holding?.balanceFormatted || '0');
        const prcNum = parseFloat(t.priceUSD || holding?.priceUSD || '0');
        const totUSD = balNum * prcNum;
        const src = apiIndex.get(addrKey(t.chainId, t.address));
        const icon =
            getAdminTokenLogo(t.address, t.chainId)
            || normalizeTokenLogoUrl(t.logoURI)
            || normalizeTokenLogoUrl(holding?.logoURI);
        return {
            id: `${t.chainId}-${t.address}`,
            symbol: t.symbol,
            name: t.name || t.symbol,
            icon,
            chainIcon: chainIconFor(t.chainId),
            tvl: t.liquidity ? `$${t.liquidity.toLocaleString()}` : 'N/A',
            liquidity: t.liquidity,
            balanceFiat: totUSD > 0 ? formatUSDPrice(totUSD) : '$0.00',
            balanceToken: holding
                ? `${formatTokenQuantity(holding.balanceFormatted || '0')} ${t.symbol}`
                : `0 ${t.symbol}`,
            address: t.address,
            chainId: t.chainId,
            decimals: t.decimals ?? 18,
            priceUSD: t.priceUSD || holding?.priceUSD,
            usdValueNum: totUSD,
            marketScore: src?.marketCap || src?.liquidity || src?.volume24h || 0,
        };
    };

    // ── Wallet holdings ─────────────────────────────────────────────────
    // Always shown first, and only the obvious-scam filter applies - a token
    // the user actually holds is a token they may legitimately want to use,
    // whatever its market data looks like.
    const walletRows = holdings
        .filter(w =>
            inScope(w.chainId)
            && !isHidden(w.chainId, w.address)
            && parseFloat(w.balanceFormatted || '0') > 0
            && !isSpamToken(w.name || '', w.symbol, w.address, w.chainId)
            && matchesSearch(w.symbol, w.name, w.address))
        .map(toRow);

    const usedAddrs = new Set(walletRows.map(r => addrKey(r.chainId, r.address)));
    const usedSyms = new Set(walletRows.map(r => symKey(r.chainId, r.symbol)));

    // `holdings` already folds in imported tokens that carry a balance, so
    // this is the complete "what the wallet actually has" set. Highest USD
    // value first; no curated defaults, no index, no zero-balance rows.
    if (walletOnly) {
        return walletRows.sort((a, b) => b.usdValueNum - a.usdValueNum);
    }

    // ── Split the raw index into verified / permissive pools ────────────
    // Same gate as the web: spam first, then a market-signal check deciding
    // whether a token is good enough to browse or only good enough to be a
    // top-up filler.
    const verifiedPool: Row[] = [];
    const permissivePool: Row[] = [];
    for (const t of apiTokens) {
        if (!inScope(t.chainId)) continue;
        if (isHidden(t.chainId, t.address)) continue;
        if (usedAddrs.has(addrKey(t.chainId, t.address))) continue;
        if (!matchesSearch(t.symbol, t.name, t.address)) continue;
        if (isSpamToken(t.name, t.symbol, t.address, t.chainId, {
            marketCap: t.marketCap,
            liquidity: t.liquidity,
            volume24h: t.volume24h,
            isHoneypot: t.isHoneypot,
        })) continue;

        const isThinIndexChain = THIN_INDEX_CHAINS.includes(t.chainId || 0);
        const hasMinimalActivity = (t.liquidity && t.liquidity > 1000) || (t.volume24h && t.volume24h > 200);
        const hasMinMarketCap = !t.marketCap || t.marketCap >= 10_000;
        const isVerified = hasMinMarketCap && (
            t.verified === true
            || t.verified === undefined
            || (isThinIndexChain && (hasMinimalActivity || t.address.startsWith('0x000')))
        );

        (isVerified ? verifiedPool : permissivePool).push(toRow(t));
    }

    // ── Custom (user-imported) tokens ───────────────────────────────────
    const customRows = imported
        .filter(ct =>
            !ct.hidden
            && inScope(ct.chainId)
            && !usedAddrs.has(addrKey(ct.chainId, ct.address))
            && matchesSearch(ct.symbol, ct.name, ct.address))
        .map(toRow);

    let others: Row[];

    if (hasSearch) {
        // Searching: surface everything real that matches, verified pool first,
        // so a pasted address or an obscure-but-genuine symbol still resolves.
        // Both pools already cleared isSpamToken.
        others = [...verifiedPool, ...permissivePool, ...customRows];
    } else {
        // Browsing: the curated list IS the list.
        const rankByKey = new Map<string, number>();
        for (const d of curated) rankByKey.set(symKey(d.chainId, d.symbol), d.rank);

        const matched = verifiedPool.filter(r => rankByKey.has(symKey(r.chainId, r.symbol)));
        matched.forEach(r => {
            usedAddrs.add(addrKey(r.chainId, r.address));
            usedSyms.add(symKey(r.chainId, r.symbol));
        });

        // Inject curated entries the index didn't return - common on the
        // non-EVM chains, whose tokens the index barely covers.
        for (const d of curated) {
            if (d.chainId === null || d.chainId === undefined) continue;
            if (!inScope(d.chainId)) continue;
            // "PLACEHOLDER" is the web's coming-soon sentinel: no real
            // contract behind it, so it must not be selectable here.
            if (!d.address || d.address === 'PLACEHOLDER') continue;
            if (usedSyms.has(symKey(d.chainId, d.symbol))) continue;
            if (isHidden(d.chainId, d.address)) continue;
            usedSyms.add(symKey(d.chainId, d.symbol));
            usedAddrs.add(addrKey(d.chainId, d.address));
            matched.push(toRow({
                symbol: d.symbol,
                name: d.name || d.symbol,
                address: d.address,
                chainId: d.chainId,
                decimals: d.decimals ?? 18,
                logoURI: resolveTokenLogo(d),
            }));
        }

        others = matched;

        // On a single chain the curated set can be thin - top up from the
        // verified pool, then the permissive one.
        if (scopedChain !== null && others.length < CURATED_TARGET_PER_CHAIN) {
            const takeFrom = (pool: Row[], remaining: number) => {
                const picked: Row[] = [];
                for (const t of pool) {
                    if (picked.length >= remaining) break;
                    if (usedSyms.has(symKey(t.chainId, t.symbol))) continue;
                    usedSyms.add(symKey(t.chainId, t.symbol));
                    usedAddrs.add(addrKey(t.chainId, t.address));
                    picked.push(t);
                }
                return picked;
            };
            const fill = CURATED_TARGET_PER_CHAIN - others.length;
            const fromVerified = takeFrom(verifiedPool, fill);
            const fromPermissive = takeFrom(permissivePool, fill - fromVerified.length);
            others = [...others, ...fromVerified, ...fromPermissive];
        }

        // Imported tokens extend past the curated set.
        others = [
            ...others,
            ...customRows.filter(c => !usedAddrs.has(addrKey(c.chainId, c.address))),
        ];
    }

    // Sort mirrors the web: TWC pinned, native gas token next, then real
    // market signal, then curated rank, then alphabetical.
    const rankByChainSymbol = new Map<string, number>();
    for (const d of curated) rankByChainSymbol.set(symKey(d.chainId, d.symbol), d.rank);
    const rankOf = (r: { chainId: number; symbol: string }) =>
        rankByChainSymbol.get(symKey(r.chainId, r.symbol));

    others.sort((a, b) => {
        const aRank = rankOf(a);
        const bRank = rankOf(b);

        const aPinned = aRank === 1;
        const bPinned = bRank === 1;
        if (aPinned !== bPinned) return aPinned ? -1 : 1;

        const aNative = isNativeAddr(a.address);
        const bNative = isNativeAddr(b.address);
        if (aNative !== bNative) return aNative ? -1 : 1;

        if (a.marketScore !== b.marketScore) return b.marketScore - a.marketScore;

        if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
        if (aRank !== undefined) return -1;
        if (bRank !== undefined) return 1;

        return a.symbol.localeCompare(b.symbol);
    });

    // Holdings lead, by USD value - the web renders them as a separate
    // section above the browse list.
    walletRows.sort((a, b) => b.usdValueNum - a.usdValueNum);

    // Final dedupe: a curated entry and a holding can resolve to the same
    // contract when the balance row and the index disagree on address casing.
    const seen = new Set<string>();
    return [...walletRows, ...others].filter(r => {
        const k = addrKey(r.chainId, r.address);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}
