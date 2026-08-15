import { TIWILoader } from '@/components/ui/TIWILoader';
import { TokenSkeleton } from '@/components/ui/TokenSkeleton';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokens } from '@/hooks/useTokens';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { formatTokenQuantity, formatUSDPrice, getColorFromSeed } from '@/utils/formatting';
import { resolveTokenLogo } from '@/utils/admin-token-logos';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useWalletStore } from '@/store/walletStore';
import { addressKeyForChain } from '@/services/swap/core/platform/wallet-context';
import { useCustomTokenStore } from '@/store/customTokenStore';
import { SelectionBottomSheet } from './SelectionBottomSheet';

// Reuse types from existing sheets
import { MORALIS_NATIVE_ADDRESS, NATIVE_TOKEN_ADDRESS, truncateAddress } from '@/utils/wallet';
import type { ChainId, ChainOption } from './ChainSelectSheet';
import type { TokenOption } from './TokenSelectSheet';

const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');
const AllChainsIcon = require('@/assets/swap/all-networks.svg');

const ALL_NETWORKS_CHAIN: ChainOption = {
    id: 'all',
    name: 'All Networks',
    icon: AllChainsIcon,
};

interface UnifiedAssetSelectSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (chain: ChainOption, token: TokenOption) => void;
    initialChainId?: ChainId | null;
    selectedTokenId?: string | null;
    initialStep?: SelectionStep;
}

type SelectionStep = 'chains' | 'tokens';

export const UnifiedAssetSelectSheet: React.FC<UnifiedAssetSelectSheetProps> = ({
    visible,
    onClose,
    onSelect,
    initialChainId,
    selectedTokenId,
    initialStep = 'chains',
}) => {
    const [step, setStep] = useState<SelectionStep>(initialStep);
    const [selectedChain, setSelectedChain] = useState<ChainOption | null>(null);
    const [tokenSearchQuery, setTokenSearchQuery] = useState('');
    const [chainSearchQuery, setChainSearchQuery] = useState('');

    const { data: chains, isLoading: isLoadingChains } = useChains();
    // console.log("🚀 ~ UnifiedAssetSelectSheet ~ chains:", chains)
    const { data: balanceData } = useWalletBalances();
    const { walletGroups, activeGroupId, address: walletAddress } = useWalletStore();
    const tokensByWallet = useCustomTokenStore(s => s.tokensByWallet);
    const hiddenWalletTokens = useCustomTokenStore(s => s.hiddenWalletTokens);
    const walletKey = activeGroupId || walletAddress || 'default';
    const customTokens = useMemo(() => {
        return tokensByWallet[walletKey] || [];
    }, [tokensByWallet, walletKey]);

    // Tokens toggled off in Manage Tokens - suppress them entirely from the
    // swap selector (both "Your Assets" and "Other Tokens") until re-enabled.
    const hiddenKeySet = useMemo(() => {
        const set = new Set<string>();
        const add = (chainId: number, address: string) => {
            const lower = address.toLowerCase();
            set.add(`${chainId}-${lower}`);
            // Cover native-address aliases so a hidden native token also
            // matches entries stored under the alternate sentinel.
            if (lower === NATIVE_TOKEN_ADDRESS || lower === MORALIS_NATIVE_ADDRESS) {
                set.add(`${chainId}-${NATIVE_TOKEN_ADDRESS}`);
                set.add(`${chainId}-${MORALIS_NATIVE_ADDRESS}`);
            }
        };
        (hiddenWalletTokens[walletKey] || []).forEach(r => add(r.chainId, r.address));
        (tokensByWallet[walletKey] || []).forEach(ct => {
            if (ct.hidden) add(ct.chainId, ct.address);
        });
        return set;
    }, [hiddenWalletTokens, tokensByWallet, walletKey]);
    const [debouncedQuery, setDebouncedQuery] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(tokenSearchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [tokenSearchQuery]);

    const { width: SCREEN_WIDTH } = Dimensions.get('window');
    const transitionX = useSharedValue(0);

    // Reset state when opening
    useEffect(() => {
        if (visible) {
            if (initialStep === 'tokens' && initialChainId) {
                const chain = chains?.find((c: any) => c.id === initialChainId);
                if (chain) {
                    setSelectedChain({
                        id: chain.id,
                        name: chain.name,
                        icon: chain.logoURI || (chain as any).logo || require('@/assets/home/chains/ethereum.svg'),
                    });
                    setStep('tokens');
                    transitionX.value = -SCREEN_WIDTH;
                } else {
                    setStep('chains');
                    transitionX.value = 0;
                }
            } else {
                setStep('chains');
                setSelectedChain(null);
                transitionX.value = 0;
            }
            setTokenSearchQuery('');
            setChainSearchQuery('');
        }
    }, [visible, initialChainId, chains, initialStep]);

    const animatedContentStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: transitionX.value }],
    }));

    // --- Chain Logic ---
    //
    // Chain → wallet address key comes from `addressKeyForChain`, the canonical
    // mapping the swap engine and balance layer use. The old 12-entry local map
    // fell back to 'EVM' for everything it didn't list (Sui, Aptos, Injective,
    // Bitcoin, every Cosmos chain, and all long-tail EVM chains), and it keyed
    // Osmosis off a bogus id (12345 instead of 249339).
    //
    // Combined with the old "only show chains this wallet holds" filter, that
    // meant a wallet WITHOUT an EVM address (a Cosmos- or Solana-only import)
    // saw almost nothing - hence a Cosmos wallet being offered just "Cosmos Hub".
    //
    // Every chain is now listed. Restricting the list was wrong anyway: the
    // DESTINATION of a cross-chain swap doesn't have to be a chain you already
    // hold, and with a pasted recipient it can be anywhere at all. Chains this
    // wallet has an address for are simply sorted to the top and marked.

    const activeGroup = useMemo(() =>
        walletGroups.find(g => g.id === activeGroupId),
        [walletGroups, activeGroupId]
    );

    /** True when the active wallet holds an address on this chain. */
    const walletHasChain = useCallback((chainId: number) => {
        const key = addressKeyForChain(chainId);
        return !!(activeGroup?.addresses as Record<string, string | undefined> | undefined)?.[key];
    }, [activeGroup]);

    const filteredChains = useMemo(() => {
        if (!chains) return [];

        const mapped = chains.map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.logoURI || (c as any).logo || require('@/assets/home/chains/ethereum.svg'),
            symbol: (c as any).symbol,
            inWallet: walletHasChain(c.id),
        }));

        const searched = mapped.filter((c: any) =>
            c.name.toLowerCase().includes(chainSearchQuery.toLowerCase()) ||
            c.symbol?.toLowerCase().includes(chainSearchQuery.toLowerCase())
        );

        // Wallet chains first, each group keeping the registry's own order.
        return [
            ...searched.filter((c: any) => c.inWallet),
            ...searched.filter((c: any) => !c.inWallet),
        ];
    }, [chains, chainSearchQuery, walletHasChain]);

    // --- Token Logic ---
    // Fetch all chain IDs if "All Networks" is selected, matching receive.tsx behavior
    const stableChains = useMemo(() => {
        if (selectedChain && selectedChain.id !== 'all') return [selectedChain.id as number];

        // "All Networks" means all of them. This used to drop every chain the
        // wallet had no address for, which on a non-EVM wallet was nearly the
        // whole list - so the token search came back empty.
        return chains?.map((c: any) => c.id) || [];
    }, [selectedChain, chains]);

    const isSearching = debouncedQuery.length > 0;

    const {
        data: response,
        isLoading: isLoadingTokens,
        isFetching: isFetchingTokens,
        isPlaceholderData
    } = useTokens({
        query: debouncedQuery,
        chains: stableChains,
        limit: 50,
        enabled: isSearching,
    });

    // Auto-fetch popular tokens for the chain when no search query
    const shouldFetchDefaults = !isSearching;

    const {
        data: defaultResponse,
        isLoading: isLoadingDefaults,
    } = useTokens({
        chains: stableChains,
        limit: 50,
        enabled: shouldFetchDefaults,
    });

    // ── Unified Token Logic (Ported from Receive Screen) ───────────────────
    const tokenOptions = useMemo(() => {
        const TWC_ADDRESS = '0xda1060158f7d593667cce0a15db346bb3ffb3596'.toLowerCase();
        const SOL_NATIVE = '11111111111111111111111111111111';
        const NATIVE_ADDRS = [NATIVE_TOKEN_ADDRESS, MORALIS_NATIVE_ADDRESS, SOL_NATIVE, 'native'];
        // One identity per (chain, token) that treats every spelling of "the
        // native coin" as the same asset - sources disagree ('native', 0x0…0,
        // the System Program) and matching them literally left the wallet's
        // native balance stranded from the list row it belongs to.
        // `So111…112` is deliberately NOT a native spelling: that mint is
        // WRAPPED SOL, a separate holding with its own row.
        const identityKey = (chainId: number, address?: string) => {
            const a = (address || '').toLowerCase();
            return NATIVE_ADDRS.includes(a) ? `${chainId}-native` : `${chainId}-${a}`;
        };

        // Curated priority symbols by chain per user request
        const CHAIN_PRIORITY: Record<number, string[]> = {
            56: ['BNB', 'USDT', 'USDC', 'WBNB', 'TWC', 'WKC', 'TWT', 'CAKE', 'BUSD'], // BSC
            1: ['ETH', 'USDT', 'USDC', 'WETH', 'WBTC', 'DAI', 'LINK', 'UNI'], // ETH
            7565164: ['SOL', 'WSOL', 'USDC', 'USDT', 'JUP', 'RAY', 'BONK'], // Solana
            137: ['POL', 'USDT', 'USDC', 'WETH', 'DAI'], // Polygon
            42161: ['ETH', 'USDC', 'USDT', 'ARB'], // Arbitrum
            10: ['ETH', 'USDC', 'USDT', 'OP'], // Optimism
            8453: ['ETH', 'USDC', 'USDT', 'AERO'], // Base
            136105027: ['TON', 'USDT', 'NOT', 'DOGS'] // TON
        };

        // 1. Get tokens from API
        const rawTokens = isSearching
            ? (response?.tokens || [])
            : (defaultResponse?.tokens || []);

        // 1b. Solana identity fix, applied client-side so the sheet is correct
        // regardless of which backend build is answering.
        //
        // So111…112 is the WRAPPED-SOL SPL mint, not native SOL - a wallet holding
        // it reads as "WSOL" in every other Solana wallet. Older backends list it
        // as "SOL", so: name that mint WSOL, and make sure native SOL is in the
        // list. Once the backend serves both itself, both steps become no-ops -
        // the relabel matches what it already sends, and the injected row dedupes
        // away on the native identity key below.
        const SOLANA_CHAIN_ID = 7565164;
        const WSOL_MINT = 'So11111111111111111111111111111111111111112';
        const solanaRows = rawTokens.filter(t => t.chainId === SOLANA_CHAIN_ID);
        const normalizedRaw = rawTokens.map(t =>
            t.chainId === SOLANA_CHAIN_ID && t.address === WSOL_MINT
                ? { ...t, symbol: 'WSOL', name: 'Wrapped SOL' }
                : t
        );
        const wsolRow = solanaRows.find(t => t.address === WSOL_MINT);
        const hasNativeSol = normalizedRaw.some(
            t => t.chainId === SOLANA_CHAIN_ID && (t.symbol || '').toUpperCase() === 'SOL'
        );
        if (wsolRow && !hasNativeSol) {
            // Borrow the wrapped row's price/logo/liquidity - same underlying asset.
            // The address is Solana's System Program, NOT the EVM zero-address:
            // it is what the swap engine recognises as native SOL, and what the
            // balance pipeline carries a lamport balance under.
            normalizedRaw.unshift({
                ...wsolRow,
                id: `${SOLANA_CHAIN_ID}-${SOL_NATIVE}`,
                address: SOL_NATIVE,
                symbol: 'SOL',
                name: 'Solana',
                decimals: 9,
            });
        }

        // 2. Map to unified objects
        const mappedApiTokens = normalizedRaw.map(t => {
            const walletToken = balanceData?.tokens.find(
                wt => identityKey(wt.chainId, wt.address) === identityKey(t.chainId, t.address)
            );
            const chainInfo = chains?.find((c: any) => c.id === t.chainId);
            const hasBalance = !!walletToken;
            const balanceNum = parseFloat(walletToken?.balanceFormatted || '0');
            // The catalogue row is not always priced (the token list and the
            // portfolio use different price sources), and when it wasn't, a
            // held balance rendered as "$0.00" - the wallet's own price and
            // USD value are just as authoritative, so fall back to them.
            const priceNum = parseFloat(t.priceUSD || '0') || parseFloat(walletToken?.priceUSD || '0');
            const totalUSD = balanceNum * priceNum || parseFloat(walletToken?.usdValue || '0');
            const icon = resolveTokenLogo({
                address: t.address,
                chainId: t.chainId,
                logoURI: t.logoURI || walletToken?.logoURI,
                logo: (t as any).logo,
            });

            return {
                id: `${t.chainId}-${t.address}`,
                symbol: t.symbol,
                name: (t.symbol === 'TWC' || t.symbol === 'TIWICAT') ? 'TIWICAT' : t.name,
                icon,
                chainIcon: chainInfo?.logoURI,
                address: t.address,
                chainId: t.chainId,
                decimals: t.decimals ?? 18,
                balanceToken: hasBalance
                    ? `${formatTokenQuantity(walletToken!.balanceFormatted)} ${t.symbol}`
                    : `0 ${t.symbol}`,
                balanceFiat: totalUSD > 0 ? formatUSDPrice(totalUSD) : '$0.00',
                isOwned: hasBalance,
                usdValueNum: totalUSD,
                priceUSD: t.priceUSD || walletToken?.priceUSD,
                _liquidity: parseFloat(t.liquidity?.toString() || '0'),
                // Carried through to the swap quote as `liquidityUSD`.
                liquidity: t.liquidity,
                _verified: !!(t as any).verified,
                isNative: NATIVE_ADDRS.includes(t.address?.toLowerCase()) || (chainInfo?.nativeCurrency?.symbol === t.symbol)
            };
        });

        // 3. Add wallet tokens that might not be in API results
        const ownedTokensOnChain = (balanceData?.tokens || [])
            .filter(wt => {
                const chainMatch = (selectedChain && selectedChain.id !== 'all') ? wt.chainId === selectedChain.id : true;
                return chainMatch;
            })
            .filter(wt => {
                // Deduplicate with API results
                return !mappedApiTokens.some(at => identityKey(at.chainId, at.address) === identityKey(wt.chainId, wt.address));
            })
            .map(wt => {
                const chainInfo = chains?.find((c: any) => c.id === wt.chainId);
                const usdVal = parseFloat(wt.usdValue || '0');
                const isNative = NATIVE_ADDRS.includes(wt.address.toLowerCase()) || (chainInfo?.nativeCurrency?.symbol === wt.symbol);
                const icon = resolveTokenLogo({
                    address: wt.address,
                    chainId: wt.chainId,
                    logoURI: wt.logoURI,
                });
                return {
                    id: `${wt.chainId}-${wt.address}`,
                    symbol: wt.symbol,
                    name: (wt.symbol === 'TWC' || wt.symbol === 'TIWICAT') ? 'TIWICAT' : wt.name,
                    icon,
                    chainIcon: chainInfo?.logoURI,
                    address: wt.address,
                    chainId: wt.chainId,
                    decimals: wt.decimals ?? 18,
                    balanceToken: `${formatTokenQuantity(wt.balanceFormatted)} ${wt.symbol}`,
                    balanceFiat: usdVal > 0 ? formatUSDPrice(usdVal) : '$0.00',
                    isOwned: true,
                    usdValueNum: usdVal,
                    priceUSD: wt.priceUSD,
                    // No liquidity figure from this source (wallet/custom
                    // token); the dedup merge picks it up from the API entry.
                    liquidity: undefined as number | undefined,
                    _liquidity: 0,
                    _verified: true,
                    isNative: isNative
                };
            });

        // Add custom tokens (from wallet's added token list) that aren't already in API/owned results
        const customMapped = customTokens
            .filter(ct =>
                !mappedApiTokens.some(at => at.address.toLowerCase() === ct.address.toLowerCase() && at.chainId === ct.chainId) &&
                !ownedTokensOnChain.some(at => at.address.toLowerCase() === ct.address.toLowerCase() && at.chainId === ct.chainId)
            )
            .map(ct => {
                const chainInfo = chains?.find((c: any) => c.id === ct.chainId);
                const bal = parseFloat(ct.balanceFormatted || '0');
                const usdVal = parseFloat(ct.usdValue || '0');
                const icon = resolveTokenLogo({
                    address: ct.address,
                    chainId: ct.chainId,
                    logoURI: ct.logoURI,
                });
                return {
                    id: `${ct.chainId}-${ct.address}`,
                    symbol: ct.symbol,
                    name: ct.name,
                    icon,
                    chainIcon: chainInfo?.logoURI,
                    address: ct.address,
                    chainId: ct.chainId,
                    decimals: ct.decimals,
                    balanceToken: `${formatTokenQuantity(ct.balanceFormatted || '0')} ${ct.symbol}`,
                    balanceFiat: usdVal > 0 ? formatUSDPrice(usdVal) : '$0.00',
                    isOwned: bal > 0,
                    usdValueNum: usdVal,
                    priceUSD: ct.priceUSD,
                    // No liquidity figure from this source (wallet/custom
                    // token); the dedup merge picks it up from the API entry.
                    liquidity: undefined as number | undefined,
                    _liquidity: 0,
                    _verified: false,
                    isNative: false,
                };
            });

        const allTokens = [...mappedApiTokens, ...ownedTokensOnChain, ...customMapped];

        // 4. Filtering and Spam Detection
        const filtered = allTokens.filter(t => {
            if (selectedChain && selectedChain.id !== 'all' && t.chainId !== selectedChain.id) return false;

            // Respect the Manage Tokens hidden list (wallet tokens + custom)
            if (hiddenKeySet.has(`${t.chainId}-${(t.address || '').toLowerCase()}`)) return false;

            if (isSearching) {
                const q = debouncedQuery.toLowerCase();
                return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q);
            }

            // Spam filtering (Tightened per user request)
            const name = t.name?.toLowerCase() || '';
            const symbol = t.symbol?.toLowerCase() || '';
            const address = t.address?.toLowerCase() || '';

            if (address.endsWith('pump') || name.includes('pump.fun')) return false;
            
            // Comprehensive Chinese/CJK range to catch "科太币" and "飞马"
            const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf\u2e80-\u2eff\u3000-\u303f]/;
            if (cjkPattern.test(name) || cjkPattern.test(symbol)) return false;

            const spamKw = ['.com', '.xyz', 'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher', 'bonus', 'gift'];
            if (spamKw.some(k => name.includes(k) || symbol.includes(k))) return false;

            // Filter out fake "ETH" or "BNB" not on native address (Eggman style)
            const symUpper = t.symbol.toUpperCase();
            if ((symUpper === 'ETH' || symUpper === 'BNB' || symUpper === 'SOL') && !t.isNative) {
                // If it's a major native symbol but not flagged as native by address, it's likely a scam
                if (!NATIVE_ADDRS.includes(address)) return false;
            }

            return true;
        });

        // 5. Deduplicate by chain+contract identity.
        //
        // Never collapse by symbol: users can hold two unrelated BSC contracts
        // both named CROSS, and picking the wrong one strands the real balance.
        // The winner is chosen as before (owned beats unowned, then deeper
        // liquidity), but only among rows that describe the same contract.
        const seen = new Map<string, any>();
        filtered.forEach(t => {
            const key = identityKey(t.chainId, t.address);
            const existing = seen.get(key);

            const bestLiquidity = Math.max(
                Number(t.liquidity) || 0,
                Number(existing?.liquidity) || 0,
            ) || undefined;
            const bestLiquidityRank = Math.max(t._liquidity || 0, existing?._liquidity || 0);

            const winner =
                !existing || (t.isOwned && !existing.isOwned) || (t._liquidity > existing._liquidity)
                    ? t
                    : existing;

            const bestIcon = resolveTokenLogo({
                address: winner.address,
                chainId: winner.chainId,
                logoURI: typeof winner.icon === 'string' ? winner.icon : undefined,
            }) || winner.icon || existing?.icon || t.icon;

            seen.set(key, { ...winner, icon: bestIcon, liquidity: bestLiquidity, _liquidity: bestLiquidityRank });
        });

        // 6. Final Sort: Ownership, Native priority, Solana ecosystem priority, then market metrics
        const sorted = Array.from(seen.values()).sort((a, b) => {
            // Owned tokens always first
            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;
            if (a.isOwned && b.isOwned) return b.usdValueNum - a.usdValueNum;

            // Curated chain-specific priority (Hardcoded list per user request)
            const prioList = CHAIN_PRIORITY[a.chainId] || [];
            const prioBList = CHAIN_PRIORITY[b.chainId] || [];
            const indexA = prioList.indexOf(a.symbol.toUpperCase());
            const indexB = prioList.indexOf(b.symbol.toUpperCase());

            if (indexA !== -1 && indexB === -1) return -1;
            if (indexA === -1 && indexB !== -1) return 1;
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;

            // Solana specific ecosystem priority for non-owned tokens (Fallback)
            if ((selectedChain?.id === 7565164 || a.chainId === 7565164) && !a.isOwned && !b.isOwned) {
                const solPrio = (t: any) => {
                    const sym = t.symbol.toUpperCase();
                    const addr = t.address?.toLowerCase();
                    if (t.isNative || sym === 'SOL') return 100;
                    if (addr === 'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v' || sym === 'USDC') return 90;
                    if (addr === 'es9vmfrzadcstmdamrjs4nhaf79ppu36hmrf6s5je6m' || sym === 'USDT') return 80;
                    return 0;
                };
                const pA = solPrio(a);
                const pB = solPrio(b);
                if (pA !== pB) return pB - pA;
            }

            // Native priority (general fallback)
            const aN = a.isNative;
            const bN = b.isNative;
            if (aN && !bN) return -1;
            if (!aN && bN) return 1;

            // TWC next
            if (a.address.toLowerCase() === TWC_ADDRESS && b.address.toLowerCase() !== TWC_ADDRESS) return -1;
            if (a.address.toLowerCase() !== TWC_ADDRESS && b.address.toLowerCase() === TWC_ADDRESS) return 1;

            // Verified / Liquidity
            if (a._verified && !b._verified) return -1;
            if (!a._verified && b._verified) return 1;
            return b._liquidity - a._liquidity;
        });

        // 7. Limit curated "Other Tokens" to 8 (but always include custom-added tokens even without balance)
        if (isSearching) return sorted;

        const customAddresses = new Set(customTokens.map(c => `${c.chainId}-${c.address.toLowerCase()}`));
        const isCustomAdded = (t: any) => customAddresses.has(`${t.chainId}-${t.address.toLowerCase()}`);

        const owned = sorted.filter(t => t.isOwned);
        const customUnowned = sorted.filter(t => !t.isOwned && isCustomAdded(t));
        const othersCurated = sorted.filter(t => !t.isOwned && !isCustomAdded(t)).slice(0, 8);

        return [...owned, ...customUnowned, ...othersCurated];
    }, [response, defaultResponse, balanceData, selectedChain, chains, debouncedQuery, isSearching, customTokens, hiddenKeySet]);


    const handleChainSelect = (chain: any) => {
        setSelectedChain({
            id: chain.id,
            name: chain.name,
            icon: chain.icon,
        });
        setStep('tokens');
        transitionX.value = withTiming(-SCREEN_WIDTH, {
            duration: 300,
            easing: Easing.out(Easing.quad),
        });
    };

    const handleTokenSelect = (token: TokenOption) => {
        if (selectedChain) {
            // Find the actual chain for this token if we are in "All Networks" mode
            let targetChain = selectedChain;
            if (selectedChain.id === 'all' && chains) {
                const actualChain = chains.find((c: any) => c.id === token.chainId);
                if (actualChain) {
                    targetChain = {
                        id: actualChain.id,
                        name: actualChain.name,
                        icon: actualChain.logoURI || (actualChain as any).logo || AllChainsIcon
                    };
                }
            }
            onSelect(targetChain, token);
        }
    };

    const handleBack = () => {
        setStep('chains');
        setTokenSearchQuery('');
        transitionX.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.quad),
        });
    };

    const renderChains = useCallback(() => {
        if (isLoadingChains) {
            return (
                <View style={styles.loaderContainer}>
                    <TIWILoader size={100} />
                </View>
            );
        }

        const data = filteredChains;
        if (!chainSearchQuery) {
            // @ts-ignore
            return [ALL_NETWORKS_CHAIN, ...data];
        }
        return data;
    }, [isLoadingChains, filteredChains, chainSearchQuery]);

    const renderChainItem = useCallback(({ item: chain }: { item: any }) => {
        const isAll = chain.id === 'all';
        const isSelected = selectedChain?.id === chain.id;

        return (
            <TouchableOpacity
                style={styles.chainItem}
                activeOpacity={0.8}
                onPress={() => handleChainSelect(chain)}
            >
                <View style={styles.chainIconWrapper}>
                    <ExpoImage source={chain.icon} style={styles.fullSize} contentFit="contain" />
                </View>
                <Text style={styles.chainName}>{chain.name}</Text>
                {/* Chains this wallet already has an address on are sorted to
                    the top; the badge says why they're up there. The rest stay
                    fully selectable - you can still swap TO a chain you don't
                    hold yet by pasting a recipient address. */}
                {!isAll && chain.inWallet && !isSelected && (
                    <View style={styles.walletBadge}>
                        <Text style={styles.walletBadgeText}>IN WALLET</Text>
                    </View>
                )}
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primaryCTA} style={styles.checkIcon} />
                )}
            </TouchableOpacity>
        );
    }, [selectedChain]);

    const TokenItem = React.memo(({ token, onSelect, selectedTokenId, isFetching, isSearching }: { token: TokenOption, onSelect: any, selectedTokenId: any, isFetching: boolean, isSearching: boolean }) => {
        const isActive = token.id === selectedTokenId;
        const [logoError, setLogoError] = useState(false);
        const handleLogoError = useCallback(() => setLogoError(true), []);
        useEffect(() => {
            setLogoError(false);
        }, [token.icon]);

        const logoSource = token.icon && !logoError ? token.icon : null;

        // Hide non-owned tokens with failed logos unless searching
        const isOwned = parseFloat((token as any).balanceFiat?.replace(/[^0-9.-]/g, '') || '0') > 0 ||
            !(token as any).balanceToken?.startsWith('0 ');
        if (!logoSource && !isOwned && !isSearching) return null;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onSelect(token)}
                style={[
                    styles.tokenItem,
                    isActive && styles.activeTokenItem,
                    isFetching && { opacity: 0.6 }
                ]}
            >
                <View style={styles.tokenContent}>
                    <View style={styles.leftInfo}>
                        <View style={styles.tokenIconContainer}>
                            <View style={styles.tokenIconWrapper}>
                                {logoSource ? (
                                    <ExpoImage source={logoSource} style={styles.fullSize} contentFit="cover" onError={handleLogoError} />
                                ) : (
                                    <View style={[styles.fallbackCircle, { backgroundColor: getColorFromSeed(token.symbol) }]}>
                                        <Text style={styles.fallbackText}>{token.symbol.charAt(0).toUpperCase()}</Text>
                                    </View>
                                )}
                            </View>

                            {token.chainIcon && (
                                <View style={styles.chainBadge}>
                                    <ExpoImage source={token.chainIcon} style={styles.fullSize} contentFit="cover" />
                                </View>
                            )}
                        </View>
                        <View style={styles.tokenTextColumn}>
                            <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                            <Text style={styles.tokenAddress}>{truncateAddress(token.address)}</Text>
                        </View>
                    </View>
                    <View style={styles.rightInfo}>
                        <Text style={styles.tokenBalance}>{token.balanceToken}</Text>
                        <Text style={styles.fiatBalance}>{token.balanceFiat}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    });

    const isTokenSearching = tokenSearchQuery.trim().length > 0;

    const renderTokenItem = useCallback(({ item: token }: { item: TokenOption }) => (
        <TokenItem
            token={token}
            onSelect={handleTokenSelect}
            selectedTokenId={selectedTokenId}
            isFetching={isFetchingTokens}
            isSearching={isTokenSearching}
        />
    ), [handleTokenSelect, selectedTokenId, isFetchingTokens, isTokenSearching]);

    const renderTokenList = () => {
        if (isLoadingTokens || (isPlaceholderData && tokenOptions.length === 0)) {
            return (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    <TokenSkeleton />
                    <TokenSkeleton />
                    <TokenSkeleton />
                    <TokenSkeleton />
                    <TokenSkeleton />
                </ScrollView>
            );
        }

        if (isSearching) {
            return (
                <FlatList
                    data={tokenOptions}
                    renderItem={renderTokenItem}
                    keyExtractor={item => item.id}
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews
                />
            );
        }

        const owned = tokenOptions.filter(t => t.isOwned);
        const others = tokenOptions.filter(t => !t.isOwned);

        const sections = [
            ...(owned.length > 0 ? [{ title: 'Your Assets', data: owned }] : []),
            ...(others.length > 0 ? [{ title: 'Other Tokens', data: others }] : []),
        ];

        if (sections.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No tokens found</Text>
                </View>
            );
        }

        return (
            <SectionList
                sections={sections}
                renderItem={renderTokenItem}
                renderSectionHeader={({ section }) => (
                    <Text style={styles.sectionHeader}>{section.title}</Text>
                )}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                stickySectionHeadersEnabled={false}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={7}
                removeClippedSubviews
            />
        );
    };

    return (
        <SelectionBottomSheet
            visible={visible}
            title={step === 'chains' ? "Select Network" : "Select Token"}
            onClose={onClose}
            onBack={step === 'tokens' ? handleBack : undefined}
            showSearchIcon={step === 'chains'} // Search icon only for chains logic
            onSearch={step === 'chains' ? setChainSearchQuery : undefined}
        >
            <View style={styles.carouselContainer}>
                <Animated.View style={[styles.carouselContent, animatedContentStyle]}>
                    {/* Step 1: Chains */}
                    <View style={[styles.stepPage, { width: SCREEN_WIDTH }]}>
                        <FlatList
                            data={renderChains() as any[]}
                            renderItem={renderChainItem}
                            keyExtractor={item => String(item.id)}
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            initialNumToRender={10}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                        />
                    </View>

                    {/* Step 2: Tokens */}
                    <View style={[styles.stepPage, { width: SCREEN_WIDTH }]}>
                        <View style={styles.tokenSearchWrapper}>
                            <View style={styles.tokenSearchContainer}>
                                <Ionicons name="search" size={20} color={colors.mutedText} />
                                <TextInput
                                    style={styles.tokenSearchInput}
                                    placeholder="Search by name or address"
                                    placeholderTextColor={colors.mutedText}
                                    value={tokenSearchQuery}
                                    onChangeText={setTokenSearchQuery}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {tokenSearchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setTokenSearchQuery('')} style={styles.clearButton}>
                                        <Ionicons name="close-circle" size={20} color={colors.mutedText} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {renderTokenList()}
                    </View>
                </Animated.View>
            </View>
        </SelectionBottomSheet>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    sectionHeader: {
        fontSize: 14,
        fontFamily: 'Manrope-Bold',
        color: colors.primaryCTA,
        marginTop: 20,
        marginBottom: 12,
        paddingHorizontal: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        opacity: 0.5,
    },
    tokenSearchWrapper: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    tokenSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: colors.bgStroke,
    },
    tokenSearchInput: {
        flex: 1,
        marginLeft: 8,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    clearButton: {
        padding: 4,
    },
    carouselContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    carouselContent: {
        flexDirection: 'row',
        height: '100%',
        width: Dimensions.get('window').width * 2,
    },
    stepPage: {
        height: '100%',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
        paddingHorizontal: 16,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    // Chain Styles
    chainItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        marginBottom: 12,
        gap: 12,
    },
    chainIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
    },
    walletBadge: {
        marginLeft: 'auto',
        backgroundColor: 'rgba(177,241,40,0.14)',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
    },
    walletBadgeText: {
        color: colors.primaryCTA,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    chainName: {
        flex: 1,
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    checkIcon: {
        marginLeft: 'auto',
    },
    // Token Styles
    tokenItem: {
        height: 76,
        borderRadius: 16,
        backgroundColor: colors.bgSemi,
        marginBottom: 12,
        overflow: 'hidden',
    },
    activeTokenItem: {
        backgroundColor: colors.bgShade20,
    },
    tokenContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: '100%',
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    tokenIconContainer: {
        width: 40,
        height: 40,
    },
    tokenIconWrapper: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
        backgroundColor: colors.bgSemi,
        overflow: 'hidden',
    },
    chainBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.bgSemi,
        borderWidth: 1.5,
        borderColor: colors.bgSemi,
        overflow: 'hidden',
    },
    fallbackCircle: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fallbackText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    tokenTextColumn: {
        gap: 4,
    },
    tokenSymbol: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    tokenAddress: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    rightInfo: {
        alignItems: 'flex-end',
        gap: 4,
    },
    tokenBalance: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    fiatBalance: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.bodyText,
    },
    loaderContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
