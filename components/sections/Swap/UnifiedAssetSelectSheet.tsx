import { TIWILoader } from '@/components/ui/TIWILoader';
import { TokenSkeleton } from '@/components/ui/TokenSkeleton';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokens } from '@/hooks/useTokens';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { formatTokenQuantity, formatUSDPrice, getColorFromSeed } from '@/utils/formatting';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useWalletStore, ChainType } from '@/store/walletStore';
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
    const { walletGroups, activeGroupId } = useWalletStore();
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
                const chain = chains?.find(c => c.id === initialChainId);
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
    const WALLET_CHAINS_TYPES: Record<number, ChainType> = {
        1: 'EVM', 56: 'EVM', 137: 'EVM', 8453: 'EVM', 10: 'EVM', 42161: 'EVM', 43114: 'EVM',
        7565164: 'SOLANA', 728126428: 'TRON', 1100: 'TON', 118: 'COSMOS', 12345: 'OSMOSIS'
    };

    const activeGroup = useMemo(() => 
        walletGroups.find(g => g.id === activeGroupId),
        [walletGroups, activeGroupId]
    );

    const filteredChains = useMemo(() => {
        if (!chains) return [];
        
        // 1. Filter chains that the wallet has addresses for (Sync with receive.tsx)
        const supported = chains.filter(c => {
            const type = WALLET_CHAINS_TYPES[c.id] || 'EVM';
            return !!activeGroup?.addresses?.[type];
        });

        // 2. Map and search filter
        const mapped = supported.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.logoURI || (c as any).logo || require('@/assets/home/chains/ethereum.svg'),
            symbol: (c as any).symbol
        }));

        return mapped.filter(c =>
            c.name.toLowerCase().includes(chainSearchQuery.toLowerCase()) ||
            c.symbol?.toLowerCase().includes(chainSearchQuery.toLowerCase())
        );
    }, [chains, chainSearchQuery, activeGroup]);

    // --- Token Logic ---
    // Fetch all chain IDs if "All Networks" is selected, matching receive.tsx behavior
    const stableChains = useMemo(() => {
        if (selectedChain && selectedChain.id !== 'all') return [selectedChain.id as number];
        
        // Filter out chains not supported by wallet when in "All Networks" mode
        return chains?.filter(c => {
            const type = WALLET_CHAINS_TYPES[c.id] || 'EVM';
            return !!activeGroup?.addresses?.[type];
        }).map(c => c.id) || [];
    }, [selectedChain, chains, activeGroup]);

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

        // Curated priority symbols by chain per user request
        const CHAIN_PRIORITY: Record<number, string[]> = {
            56: ['BNB', 'USDT', 'USDC', 'WBNB', 'TWC', 'WKC', 'TWT', 'CAKE', 'BUSD'], // BSC
            1: ['ETH', 'USDT', 'USDC', 'WETH', 'WBTC', 'DAI', 'LINK', 'UNI'], // ETH
            7565164: ['SOL', 'USDC', 'USDT', 'JUP', 'RAY', 'BONK'], // Solana
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

        // 2. Map to unified objects
        const mappedApiTokens = rawTokens.map(t => {
            const walletToken = balanceData?.tokens.find(
                wt => wt.address.toLowerCase() === t.address.toLowerCase() && wt.chainId === t.chainId
            );
            const chainInfo = chains?.find(c => c.id === t.chainId);
            const hasBalance = !!walletToken;
            const balanceNum = parseFloat(walletToken?.balanceFormatted || '0');
            const priceNum = parseFloat(t.priceUSD || '0');
            const totalUSD = balanceNum * priceNum;

            return {
                id: `${t.chainId}-${t.address}`,
                symbol: t.symbol,
                name: (t.symbol === 'TWC' || t.symbol === 'TIWICAT') ? 'TIWICAT' : t.name,
                icon: t.logoURI || (t as any).logo,
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
                priceUSD: t.priceUSD,
                _liquidity: parseFloat(t.liquidity?.toString() || '0'),
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
                return !mappedApiTokens.some(at => at.address.toLowerCase() === wt.address.toLowerCase() && at.chainId === wt.chainId);
            })
            .map(wt => {
                const chainInfo = chains?.find(c => c.id === wt.chainId);
                const usdVal = parseFloat(wt.usdValue || '0');
                const isNative = NATIVE_ADDRS.includes(wt.address.toLowerCase()) || (chainInfo?.nativeCurrency?.symbol === wt.symbol);
                return {
                    id: `${wt.chainId}-${wt.address}`,
                    symbol: wt.symbol,
                    name: (wt.symbol === 'TWC' || wt.symbol === 'TIWICAT') ? 'TIWICAT' : wt.name,
                    icon: wt.logoURI,
                    chainIcon: chainInfo?.logoURI,
                    address: wt.address,
                    chainId: wt.chainId,
                    decimals: wt.decimals ?? 18,
                    balanceToken: `${formatTokenQuantity(wt.balanceFormatted)} ${wt.symbol}`,
                    balanceFiat: usdVal > 0 ? formatUSDPrice(usdVal) : '$0.00',
                    isOwned: true,
                    usdValueNum: usdVal,
                    priceUSD: wt.priceUSD,
                    _liquidity: 0,
                    _verified: true,
                    isNative: isNative
                };
            });

        const allTokens = [...mappedApiTokens, ...ownedTokensOnChain];

        // 4. Filtering and Spam Detection
        const filtered = allTokens.filter(t => {
            if (selectedChain && selectedChain.id !== 'all' && t.chainId !== selectedChain.id) return false;

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

        // 5. Deduplicate by chain+symbol
        const seen = new Map<string, any>();
        filtered.forEach(t => {
            const key = `${t.chainId}-${t.symbol.toUpperCase()}`;
            const existing = seen.get(key);
            if (!existing || (t.isOwned && !existing.isOwned) || (t._liquidity > existing._liquidity)) {
                seen.set(key, t);
            }
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

        // 7. Limit curated "Other Tokens" to exactly 8, while showing all owned tokens
        if (isSearching) return sorted;

        const owned = sorted.filter(t => t.isOwned);
        const othersCurated = sorted.filter(t => !t.isOwned).slice(0, 8);
        
        return [...owned, ...othersCurated];
    }, [response, defaultResponse, balanceData, selectedChain, chains, debouncedQuery, isSearching]);


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
                const actualChain = chains.find(c => c.id === token.chainId);
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
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primaryCTA} style={styles.checkIcon} />
                )}
            </TouchableOpacity>
        );
    }, [selectedChain]);

    const TokenItem = React.memo(({ token, onSelect, selectedTokenId, isFetching }: { token: TokenOption, onSelect: any, selectedTokenId: any, isFetching: boolean }) => {
        const isActive = token.id === selectedTokenId;
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
                                {token.icon ? (
                                    <ExpoImage source={token.icon} style={styles.fullSize} contentFit="cover" />
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

    const renderTokenItem = useCallback(({ item: token }: { item: TokenOption }) => (
        <TokenItem
            token={token}
            onSelect={handleTokenSelect}
            selectedTokenId={selectedTokenId}
            isFetching={isFetchingTokens}
        />
    ), [handleTokenSelect, selectedTokenId, isFetchingTokens]);

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
                />
            );
        }

        const owned = tokenOptions.filter(t => t.isOwned);
        const others = tokenOptions.filter(t => !t.isOwned);

        return (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {owned.length > 0 && (
                    <>
                        <Text style={styles.sectionHeader}>Your Assets</Text>
                        {owned.map(t => (
                            <React.Fragment key={`owned-${t.id}`}>
                                {renderTokenItem({ item: t })}
                            </React.Fragment>
                        ))}
                    </>
                )}
                {others.length > 0 && (
                    <>
                        <Text style={styles.sectionHeader}>Other Tokens</Text>
                        {others.map(t => (
                            <React.Fragment key={`other-${t.id}`}>
                                {renderTokenItem({ item: t })}
                            </React.Fragment>
                        ))}
                    </>
                )}
                {tokenOptions.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No tokens found</Text>
                    </View>
                )}
            </ScrollView>
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
