import { api } from '@/lib/mobile/api-client';
import { moralisService } from '@/services/moralisService';
import { notificationService } from '@/services/notificationService';
import { useFilterStore } from '@/store/filterStore';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

// Major chains supported by Tiwi
const ALL_SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161, 8453, 10, 43114, 59144, 250, 42220, 100, 7565164, 1100];

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

function filterToken(b: any): boolean {
    const usdValue = parseFloat(b.usdValue || '0');
    const balance = parseFloat(b.balanceFormatted || b.balance || '0');
    const symbol = (b.symbol || '').toUpperCase();
    const name = (b.name || '').toLowerCase();
    const addr = b.address?.toLowerCase() || '';

    if (balance <= 0.000001) return false;
    if (BLACKLISTED_SYMBOLS.includes(symbol)) return false;
    if (/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(name) || /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(symbol)) return false;
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

                let rawBalances: any[] = [];
                let backendTotalUSD: string | null = null;
                let backendDailyChange: number | null = null;
                let backendDailyChangeUSD: string | null = null;

                // ── 1. TIWI Backend (PRIMARY) for EVM ──
                if (evmAddr && isEvmAddress(evmAddr)) {
                    try {
                        const resp = await api.wallet.balances({ address: evmAddr, chains: chainIdsForFetch }) as any;
                        const balances = Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);
                        rawBalances.push(...balances);

                        // Capture portfolio-level metrics from TIWI backend
                        if (resp?.totalUSD) backendTotalUSD = resp.totalUSD;
                        if (resp?.dailyChange != null) backendDailyChange = resp.dailyChange;
                        if (resp?.dailyChangeUSD) backendDailyChangeUSD = resp.dailyChangeUSD;
                    } catch {
                        // ── Moralis FALLBACK for EVM ──
                        try {
                            console.warn('[useWalletBalances] TIWI backend failed, falling back to Moralis');
                            const moralisTokens = await moralisService.getWalletBalances(evmAddr, chainIdsForFetch);
                            rawBalances.push(...moralisTokens);
                        } catch {
                            console.warn('[useWalletBalances] Moralis fallback also failed');
                        }
                    }
                }

                // ── 2. Solana balances ──
                if (solAddr) {
                    try {
                        const resp = await api.wallet.balances({ address: solAddr, chains: [7565164] }) as any;
                        const balances = Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);
                        rawBalances.push(...balances);
                    } catch (e: any) {
                        console.warn('[useWalletBalances] Solana fetch failed:', e.message);
                    }
                }

                // ── 3. TRON balances ──
                if (tronAddr) {
                    try {
                        const resp = await api.wallet.balances({ address: tronAddr, chains: [728126428] }) as any;
                        const balances = Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);
                        rawBalances.push(...balances);
                    } catch {
                        // TRON balance fetch failed silently
                    }
                }

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
                // Use TIWI backend values if available, otherwise calculate from tokens
                let totalNetWorthUsd: string;
                let portfolioChangeAmount: string;
                let portfolioChangePercent: string;

                if (backendTotalUSD) {
                    // TIWI backend provided portfolio metrics — use directly
                    totalNetWorthUsd = parseFloat(backendTotalUSD).toFixed(2);
                    portfolioChangePercent = backendDailyChange != null ? backendDailyChange.toFixed(2) : '0.00';
                    portfolioChangeAmount = backendDailyChangeUSD ? parseFloat(backendDailyChangeUSD).toFixed(2) : '0.00';
                } else {
                    // Fallback: calculate from individual tokens (Moralis path)
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

                    totalNetWorthUsd = totalUsdToday.toFixed(2);
                    portfolioChangeAmount = totalGainUsd.toFixed(2);
                    portfolioChangePercent = pctChange.toFixed(2);
                }

                const sortedTokens = tokens.sort((a, b) => parseFloat(b.usdValue) - parseFloat(a.usdValue));

                // Check for significant price movements and send alerts (in-app)
                notificationService.checkPriceAlerts(sortedTokens);

                // Sync the held tokens to Supabase so the server-side price-alert
                // cron can push when the app is closed.
                if (activeAddress) {
                    notificationService.syncWatchedTokens(activeAddress, sortedTokens);
                }

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
        staleTime: 1000 * 60,
    });
}
