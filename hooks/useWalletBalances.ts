import { api } from '@/lib/mobile/api-client';
import { moralisService } from '@/services/moralisService';
import { notificationService } from '@/services/notificationService';
import { useFilterStore } from '@/store/filterStore';
import { useWalletStore } from '@/store/walletStore';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

// Major chains supported by Tiwi
const ALL_SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161, 8453, 10, 43114, 59144, 250, 42220, 100, 7565164, 1100];

// Chains whose chainId we can confidently resolve to a display name. A
// token coming back on any other chain is almost always an airdrop scam
// (e.g. "USDC Unknown") since the legit app only queries these chains.
// TRON is queried via a separate code path so it's listed here too.
const KNOWN_CHAIN_IDS = new Set<number>([
    ...ALL_SUPPORTED_CHAIN_IDS,
    728126428, // TRON
]);

const isEvmAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

// Nexxend logo fallback for tokens missing logoURI
const NEXXEND_LOGO_MAP: Record<string, string> = {
    ETH: 'https://nexxend.xyz/api/v1/tokens/1/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/logo',
    WETH: 'https://nexxend.xyz/api/v1/tokens/1/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2/logo',
    BNB: 'https://nexxend.xyz/api/v1/tokens/56/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/logo',
    WBNB: 'https://nexxend.xyz/api/v1/tokens/56/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c/logo',
    USDT: 'https://nexxend.xyz/api/v1/tokens/56/0x55d398326f99059ff775485246999027b3197955/logo',
    USDC: 'https://nexxend.xyz/api/v1/tokens/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48/logo',
    DAI: 'https://nexxend.xyz/api/v1/tokens/1/0x6b175474e89094c44da98b954eedeac495271d0f/logo',
    MATIC: 'https://nexxend.xyz/api/v1/tokens/137/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/logo',
    POL: 'https://nexxend.xyz/api/v1/tokens/137/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/logo',
    AVAX: 'https://nexxend.xyz/api/v1/tokens/43114/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/logo',
    ARB: 'https://nexxend.xyz/api/v1/tokens/42161/0x912ce59144191c1204e64559fe8253a0e49e6548/logo',
    OP: 'https://nexxend.xyz/api/v1/tokens/10/0x4200000000000000000000000000000000000042/logo',
    CAKE: 'https://nexxend.xyz/api/v1/tokens/56/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82/logo',
    SOL: 'https://nexxend.xyz/api/v1/tokens/7565164/So11111111111111111111111111111111111111112/logo',
    WSOL: 'https://nexxend.xyz/api/v1/tokens/7565164/So11111111111111111111111111111111111111112/logo',
    TWC: 'https://nexxend.xyz/api/v1/tokens/56/0xda1060158f7d593667cce0a15db346bb3ffb3596/logo',
    TRX: 'https://nexxend.xyz/api/v1/tokens/728126428/native/logo',
    TON: 'https://nexxend.xyz/api/v1/tokens/1360104473/native/logo',
    ATOM: 'https://nexxend.xyz/api/v1/tokens/118/native/logo',
    LINK: 'https://nexxend.xyz/api/v1/tokens/1/0x514910771af9ca656af840dff83e8264ecf986ca/logo',
    UNI: 'https://nexxend.xyz/api/v1/tokens/1/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984/logo',
    AAVE: 'https://nexxend.xyz/api/v1/tokens/1/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9/logo',
};

function getLogoFallback(symbol?: string): string | undefined {
    return NEXXEND_LOGO_MAP[(symbol || '').toUpperCase()];
}

// Spam/quality filtering
const BLACKLISTED_SYMBOLS = ['SN3', 'BSB'];
const SACRED_SYMBOLS = ['ETH', 'BNB', 'SOL', 'WSOL', 'MATIC', 'POL', 'AVAX', 'BASE', 'ARB', 'OP', 'USDT', 'USDC', 'DAI', 'CAKE', 'TRX', 'TON', 'ATOM', 'OSMO'];
const SACRED_ADDRESSES = ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000001010', 'So11111111111111111111111111111111111111112'];
const SPAM_KEYWORDS = ['.com', '.xyz', '.net', '.io', '.org', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher', 'gift', 'win', 'bonus'];

// Symbols that airdrop scammers commonly impersonate — stablecoins and
// wrapped tokens. A token claiming one of these symbols MUST sit at the
// officially-known contract address for its chain; otherwise it's the
// classic fake-USDC/fake-USDT scam with a bogus price feed.
const IMPERSONATED_STABLES = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'WETH', 'WBTC', 'WBNB', 'WMATIC', 'WAVAX']);

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

function filterToken(b: any): boolean {
    const usdValue = parseFloat(b.usdValue || '0');
    const balance = parseFloat(b.balanceFormatted || b.balance || '0');
    const symbol = (b.symbol || '').toUpperCase();
    const name = (b.name || '').toLowerCase();
    const addr = b.address?.toLowerCase() || '';

    if (balance <= 0.000001) return false;
    if (BLACKLISTED_SYMBOLS.includes(symbol)) return false;
    if (/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(name) || /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(symbol)) return false;
    // Reject tokens on chains we don't support — these would render with
    // an "Unknown" chain label and are almost always airdrop spam.
    const chainIdNum = Number(b.chainId);
    if (!chainIdNum || !KNOWN_CHAIN_IDS.has(chainIdNum)) return false;

    // Airdrop impersonation guard — a token claiming to be USDC/USDT/
    // DAI/etc. MUST be at the real contract address for its chain.
    // Everything else is the fake-stablecoin scam with a bogus price
    // feed (e.g. "0.744 USDC = $744,000"). Must be before SACRED_SYMBOLS
    // or the scam slips through via the symbol whitelist.
    if (IMPERSONATED_STABLES.has(symbol)) {
        const officialAddr = OFFICIAL_STABLE_ADDRESSES[chainIdNum]?.[symbol]?.toLowerCase();
        if (officialAddr && addr !== officialAddr) return false;
    }

    if (SACRED_SYMBOLS.includes(symbol) || SACRED_ADDRESSES.includes(addr)) return true;

    const isTWC = symbol === 'TWC' || addr === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
    if (isTWC) return true;

    const isVerified = b.verified === true || b.verified_contract === true || b.native_token === true;
    const hasRealLogo = b.logoURI && !b.logoURI.includes('/placeholder/');
    if (isVerified) return usdValue > 0.01 || !!hasRealLogo;

    const chg = parseFloat(b.priceChange24h || '0');
    if (Math.abs(chg) > 10000) return false;
    if (SPAM_KEYWORDS.some(k => name.includes(k) || symbol.toLowerCase().includes(k))) return false;
    if (addr && /^(.)\1{3}$/.test(addr.replace('0x', '').slice(-4))) return false;
    if (b.possible_spam === true) return false;
    if (hasRealLogo && usdValue >= 1.00) return true;
    if (usdValue >= 5.00) return true;

    return false;
}

function normalizeToken(b: any) {
    const sym = (b.symbol || '').toUpperCase();
    return {
        ...b,
        symbol: sym === 'WSOL' ? 'SOL' : b.symbol,
        name: sym === 'WSOL' ? 'Solana' : (b.name || b.symbol || 'Unknown'),
        logoURI: b.logoURI || b.logo || getLogoFallback(b.symbol),
        balanceFormatted: b.balanceFormatted || b.balance || '0',
        usdValue: b.usdValue || '0',
        priceChange24h: parseFloat(b.priceChange24h || '0'),
    };
}

export function useWalletBalances() {
    const { activeAddress, activeGroupId, walletGroups, _hasHydrated } = useWalletStore();
    const selectedChains = useFilterStore((state) => state.chains);

    const chainIdsForFetch = useMemo(() => {
        if (selectedChains.size > 0) {
            return Array.from(selectedChains).map(Number).filter(n => !isNaN(n));
        }
        return ALL_SUPPORTED_CHAIN_IDS;
    }, [selectedChains]);

    const group = useMemo(() => walletGroups.find(g => g.id === activeGroupId), [walletGroups, activeGroupId]);

    return useQuery({
        queryKey: ['walletBalances', activeAddress, activeGroupId, chainIdsForFetch],
        queryFn: async () => {
            if (!_hasHydrated || !activeAddress) {
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }

            try {
                const evmAddr = group?.addresses?.EVM;
                const solAddr = group?.addresses?.SOLANA;
                const tronAddr = group?.addresses?.TRON;

                // ── 1-3. Fetch EVM + Solana + TRON balances in parallel ──
                // Total latency = max(evm, sol, tron), not the sum. Each
                // branch catches its own errors so one flaky chain never
                // blocks the others.
                const [evmResult, solResult, tronResult] = await Promise.all([
                    (async () => {
                        if (!evmAddr || !isEvmAddress(evmAddr)) {
                            return { balances: [] as any[] };
                        }
                        try {
                            const resp = await api.wallet.balances({
                                address: evmAddr,
                                chains: chainIdsForFetch,
                            }) as any;
                            return {
                                balances: Array.isArray(resp?.balances)
                                    ? resp.balances
                                    : (Array.isArray(resp) ? resp : []),
                            };
                        } catch {
                            // ── Moralis FALLBACK for EVM ──
                            try {
                                console.warn('[useWalletBalances] TIWI backend failed, falling back to Moralis');
                                const moralisTokens = await moralisService.getWalletBalances(evmAddr, chainIdsForFetch);
                                return { balances: moralisTokens };
                            } catch {
                                console.warn('[useWalletBalances] Moralis fallback also failed');
                                return { balances: [] as any[] };
                            }
                        }
                    })(),
                    (async () => {
                        if (!solAddr) return { balances: [] as any[] };
                        try {
                            const resp = await api.wallet.balances({
                                address: solAddr,
                                chains: [7565164],
                            }) as any;
                            return {
                                balances: Array.isArray(resp?.balances)
                                    ? resp.balances
                                    : (Array.isArray(resp) ? resp : []),
                            };
                        } catch (e: any) {
                            console.warn('[useWalletBalances] Solana fetch failed:', e?.message);
                            return { balances: [] as any[] };
                        }
                    })(),
                    (async () => {
                        if (!tronAddr) return { balances: [] as any[] };
                        try {
                            const resp = await api.wallet.balances({
                                address: tronAddr,
                                chains: [728126428],
                            }) as any;
                            return {
                                balances: Array.isArray(resp?.balances)
                                    ? resp.balances
                                    : (Array.isArray(resp) ? resp : []),
                            };
                        } catch {
                            return { balances: [] as any[] };
                        }
                    })(),
                ]);

                const rawBalances: any[] = [
                    ...evmResult.balances,
                    ...solResult.balances,
                    ...tronResult.balances,
                ];

                // ── 4. Deduplicate ──
                const dedupedMap = new Map<string, any>();
                rawBalances.forEach(b => {
                    if (!b) return;
                    const isNative = ['native', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', '0x0000000000000000000000000000000000000000'].includes(b.address?.toLowerCase() || '');
                    const addr = isNative ? '0x0000000000000000000000000000000000000000' : b.address?.toLowerCase();
                    const key = `${addr}-${b.chainId}-${(b.symbol || '').toUpperCase()}`;
                    if (!dedupedMap.has(key)) dedupedMap.set(key, b);
                });

                // ── 5. Filter spam + normalize ──
                const tokens = Array.from(dedupedMap.values())
                    .filter(filterToken)
                    .map(normalizeToken);

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

                return {
                    tokens: sortedTokens,
                    totalNetWorthUsd,
                    portfolioChange: {
                        amount: portfolioChangeAmount,
                        percent: portfolioChangePercent,
                    },
                };
            } catch (error) {
                console.error('[useWalletBalances] Error:', error);
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }
        },
        enabled: _hasHydrated && !!activeAddress,
        // 3-minute freshness: navigating between tabs or re-opening the
        // app shortly after close reads straight from cache — no refetch,
        // no "Updating…" flash, no spinner. Pull-to-refresh still works
        // for manual updates, and the 1-min window on the old value was
        // aggressive enough to cause a visible lag on every tab switch.
        staleTime: 1000 * 60 * 3,
        // Keep the cache around for 15 minutes even after all consumers
        // unmount, so background-to-foreground transitions reuse it.
        gcTime: 1000 * 60 * 15,
        // Show the last-seen balances instantly while a refresh happens in
        // the background, so the screen never flashes empty on revisit.
        placeholderData: keepPreviousData,
    });
}
