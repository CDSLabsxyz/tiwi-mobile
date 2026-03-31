import { api } from '@/lib/mobile/api-client';
import { moralisService } from '@/services/moralisService';
import { useFilterStore } from '@/store/filterStore';
import { useWalletStore } from '@/store/walletStore';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

// Major chains supported by Tiwi (defaults for fetching if no specific filter is active)
const ALL_SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161, 8453, 10, 43114, 59144, 250, 42220, 100, 7565164, 1100];

export function useWalletBalances() {
    const { activeAddress, activeGroupId, walletGroups, _hasHydrated } = useWalletStore();
    const selectedChains = useFilterStore((state) => state.chains);

    const chainIdsForFetch = useMemo(() => {
        if (selectedChains.size > 0) {
            return Array.from(selectedChains).map(Number).filter(n => !isNaN(n));
        }
        return ALL_SUPPORTED_CHAIN_IDS;
    }, [selectedChains]);

    // Collect all addresses from the active wallet group
    const allAddresses = useMemo(() => {
        const group = walletGroups.find(g => g.id === activeGroupId);
        if (!group) return activeAddress ? [activeAddress] : [];
        const addrs = new Set<string>();
        if (group.addresses?.EVM) addrs.add(group.addresses.EVM);
        if (group.addresses?.SOLANA) addrs.add(group.addresses.SOLANA);
        if (group.addresses?.TRON) addrs.add(group.addresses.TRON);
        if (group.addresses?.TON) addrs.add(group.addresses.TON);
        if (group.addresses?.COSMOS) addrs.add(group.addresses.COSMOS);
        if (group.addresses?.OSMOSIS) addrs.add(group.addresses.OSMOSIS);
        if (addrs.size === 0 && activeAddress) addrs.add(activeAddress);
        return Array.from(addrs);
    }, [walletGroups, activeGroupId, activeAddress]);

    return useQuery({
        queryKey: ['walletBalances', allAddresses, chainIdsForFetch],
        queryFn: async () => {
            if (!_hasHydrated || allAddresses.length === 0) {
                return { tokens: [], totalNetWorthUsd: '0.00', portfolioChange: { amount: '0.00', percent: '0.00' } };
            }

            try {
                // 1. Fetch balances for ALL wallet addresses in parallel
                let rawBalances: any[] = [];

                const isEvmAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

                // Get chain-typed addresses from wallet group
                const group = walletGroups.find(g => g.id === activeGroupId);
                const evmAddr = group?.addresses?.EVM;
                const solAddr = group?.addresses?.SOLANA;
                const tronAddr = group?.addresses?.TRON;

                const fetchPromises: Promise<any[]>[] = [];

                // 1. EVM balances (primary + Moralis fallback)
                if (evmAddr && isEvmAddress(evmAddr)) {
                    fetchPromises.push((async () => {
                        try {
                            const resp = await api.wallet.balances({
                                address: evmAddr,
                                chains: chainIdsForFetch,
                            }) as any;
                            return Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);
                        } catch {
                            try {
                                return await moralisService.getWalletBalances(evmAddr, chainIdsForFetch);
                            } catch {
                                return [];
                            }
                        }
                    })());
                }

                // 2. Solana balances
                if (solAddr) {
                    fetchPromises.push((async () => {
                        try {
                            console.log('[useWalletBalances] Fetching Solana balances for:', solAddr);
                            const resp = await api.wallet.balances({
                                address: solAddr,
                                chains: [7565164],
                            }) as any;
                            const balances = Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);
                            console.log('[useWalletBalances] Solana balances found:', balances.length);
                            return balances;
                        } catch (e: any) {
                            console.warn('[useWalletBalances] Solana balance fetch failed:', e.message);
                            return [];
                        }
                    })());
                }

                // 3. TRON balances
                if (tronAddr) {
                    fetchPromises.push((async () => {
                        try {
                            const resp = await api.wallet.balances({
                                address: tronAddr,
                                chains: [728126428],
                            }) as any;
                            return Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);
                        } catch {
                            return [];
                        }
                    })());
                }

                const results = await Promise.all(fetchPromises);
                rawBalances = results.flat();

                // 2. Deduplicate
                const dedupedMap = new Map<string, any>();
                rawBalances.forEach(b => {
                    if (!b) return;
                    const isNative = b.address?.toLowerCase() === 'native' ||
                        b.address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                        b.address?.toLowerCase() === '0x0000000000000000000000000000000000000000';
                    const addr = isNative ? '0x0000000000000000000000000000000000000000' : b.address?.toLowerCase();
                    const key = `${addr}-${b.chainId}-${b.symbol?.toUpperCase()}`;
                    if (!dedupedMap.has(key)) dedupedMap.set(key, b);
                });

                // 3. Filter spam and dust with extreme prejudice
                const tokens = Array.from(dedupedMap.values())
                    .filter(b => {
                        const usdValue = parseFloat(b.usdValue || '0');
                        const balance = parseFloat(b.balanceFormatted || b.balance || '0');
                        const symbol = (b.symbol || '').toUpperCase();
                        const name = (b.name || '').toLowerCase();
                        const addr = b.address?.toLowerCase();

                        // 0. MANDATORY: Must have some balance to even be considered
                        if (balance <= 0.000001) return false;

                        // 0.5 BLACKLIST — known spam tokens
                        const BLACKLISTED_SYMBOLS = ['SN3'];
                        if (BLACKLISTED_SYMBOLS.includes(symbol)) return false;

                        // 1. SACRED LIST (Native/Trustable)
                        const isSacred = ['ETH', 'BNB', 'SOL', 'MATIC', 'POL', 'AVAX', 'BASE', 'ARB', 'OP', 'USDT', 'USDC', 'DAI', 'CAKE'].includes(symbol) ||
                            addr === '0x0000000000000000000000000000000000000000' ||
                            addr === '0x0000000000000000000000000000000000001010';
                        if (isSacred) return true;

                        // 2. VERIFIED / PROJECT TOKENS (TWC)
                        const isVerified = b.verified === true || b.verified_contract === true || b.native_token === true;
                        const isTWC = symbol === 'TWC' || addr === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
                        
                        // Rule 1: Show project tokens if they have balance
                        if (isTWC) return true;
                        
                        // Rule 2: Show Verified tokens if they have value or a real logo
                        const hasRealLogo = b.logoURI && !b.logoURI.includes('/placeholder/');
                        if (isVerified) return usdValue > 0.01 || hasRealLogo;

                        // Rule 3: Hide suspicious gains
                        const chg = parseFloat(b.priceChange24h || '0');
                        if (Math.abs(chg) > 10000) return false;

                        // Rule 4: Spam name/symbol detection
                        const spamKw = ['.com', '.xyz', '.net', '.io', '.org', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher', 'gift', 'win', 'bonus'];
                        if (spamKw.some(k => name.includes(k) || symbol.toLowerCase().includes(k))) return false;
                        if (/[\u4e00-\u9fa5]/.test(name)) return false;

                        // Rule 5: Honeypot address patterns (repeated chars at end)
                        if (addr) {
                            const clean = addr.replace('0x', '');
                            const last4 = clean.slice(-4);
                            if (/^(.)\1{3}$/.test(last4)) return false;
                        }

                        // Rule 6: Unverified must have at least $1.00 value AND a real logo
                        // OR at least $5.00 value even without a logo
                        // BUT also must not be a possible_spam token
                        if (b.possible_spam === true) return false;

                        if (hasRealLogo && usdValue >= 1.00) return true;
                        if (usdValue >= 5.00) return true;

                        return false;
                    })
                    .map(b => ({
                        ...b,
                        balanceFormatted: b.balanceFormatted || b.balance || '0',
                        usdValue: b.usdValue || '0',
                        priceChange24h: parseFloat(b.priceChange24h || '0'),
                    }));

                // 4. Weighted Calculation
                const totalUsd = tokens.reduce((sum, t) => sum + parseFloat(t.usdValue || "0"), 0);
                let weightedDailyChange = 0;
                let totalDailyChangeUSD = 0;

                // 4. Correct Portfolio Change Calculation (Basis: Yesterday's Value)
                const totalUsdToday = tokens.reduce((sum, t) => sum + parseFloat(t.usdValue || "0"), 0);
                let totalUsdYesterday = 0;
                let totalGainUsd = 0;

                tokens.forEach((token) => {
                    const valToday = parseFloat(token.usdValue || "0");
                    const chg = token.priceChange24h || 0;

                    if (valToday > 0) {
                        // Avoid division by zero for -100% drops
                        const safeChange = Math.max(chg, -99.99);
                        const valYesterday = valToday / (1 + safeChange / 100);

                        totalUsdYesterday += valYesterday;
                        totalGainUsd += (valToday - valYesterday);

                        if (Math.abs(chg) > 0.01) {
                            console.log(`[useWalletBalances] Token: ${token.symbol} | Today: $${valToday.toFixed(2)} | Change: ${chg.toFixed(2)}% | Yesterday: $${valYesterday.toFixed(2)}`);
                        }
                    }
                });

                // Portfolio % = (Total Gain / Total Value Yesterday) * 100
                const portfolioChangePercent = totalUsdYesterday > 0
                    ? (totalGainUsd / totalUsdYesterday) * 100
                    : 0;

                console.log(`[useWalletBalances] FINAL: Today $${totalUsdToday.toFixed(2)}, Yesterday $${totalUsdYesterday.toFixed(2)}, Gain $${totalGainUsd.toFixed(2)} (${portfolioChangePercent.toFixed(2)}%)`);

                return {
                    tokens: tokens.sort((a, b) => parseFloat(b.usdValue) - parseFloat(a.usdValue)),
                    totalNetWorthUsd: totalUsdToday.toFixed(2),
                    portfolioChange: {
                        amount: totalGainUsd.toFixed(2),
                        percent: portfolioChangePercent.toFixed(2),
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
