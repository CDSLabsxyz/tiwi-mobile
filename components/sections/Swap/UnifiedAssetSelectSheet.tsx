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
    const filteredChains = useMemo(() => {
        if (!chains) return [];
        const mapped = chains.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.logoURI || (c as any).logo || require('@/assets/home/chains/ethereum.svg'),
            symbol: (c as any).symbol
        }));

        return mapped.filter(c =>
            c.name.toLowerCase().includes(chainSearchQuery.toLowerCase()) ||
            c.symbol?.toLowerCase().includes(chainSearchQuery.toLowerCase())
        );
    }, [chains, chainSearchQuery]);

    // --- Token Logic ---
    const stableChains = useMemo(() =>
        (selectedChain && selectedChain.id !== 'all') ? [selectedChain.id as number] : undefined,
        [selectedChain]);

    const isSearching = debouncedQuery.length > 0;

    const {
        data: response,
        isLoading: isLoadingTokens,
        isFetching: isFetchingTokens,
        isPlaceholderData
    } = useTokens({
        query: debouncedQuery,
        chains: stableChains,
        enabled: isSearching, // Only fetch when user is actively searching
    });
    const tokens = response?.tokens;

    // ── NO SEARCH: only wallet-owned tokens ─────────────────────────────
    const walletTokenOptions: TokenOption[] = useMemo(() => {
        if (!balanceData?.tokens) return [];
        return balanceData.tokens
            .filter(wt => {
                // Filter by selected chain if one is chosen (not "All Networks")
                if (selectedChain && selectedChain.id !== 'all') {
                    return wt.chainId === selectedChain.id;
                }
                return true;
            })
            .sort((a, b) => parseFloat(b.usdValue || '0') - parseFloat(a.usdValue || '0'))
            .map(wt => {
                const chainInfo = chains?.find(c => c.id === wt.chainId);
                const usdVal = parseFloat(wt.usdValue || '0');
                return {
                    id: `${wt.chainId}-${wt.address}`,
                    symbol: wt.symbol,
                    name: wt.name,
                    icon: wt.logoURI,
                    chainIcon: chainInfo?.logoURI,
                    tvl: 'N/A',
                    balanceFiat: usdVal > 0 ? formatUSDPrice(usdVal) : '$0.00',
                    balanceToken: `${formatTokenQuantity(wt.balanceFormatted)} ${wt.symbol}`,
                    address: wt.address,
                    chainId: wt.chainId,
                    decimals: wt.decimals ?? 18,
                    priceUSD: wt.priceUSD,
                    isOwned: true,
                    usdValueNum: usdVal,
                } as TokenOption;
            });
    }, [balanceData, selectedChain, chains]);

    // ── WITH SEARCH: full API list, intensive filtering + deduplication ──
    const searchTokenOptions: TokenOption[] = useMemo(() => {
        if (!isSearching || !tokens) return [];

        const TWC_ADDRESS = '0xda1060158f7d593667cce0a15db346bb3ffb3596'.toLowerCase();
        const NATIVE_ADDRS = [NATIVE_TOKEN_ADDRESS, MORALIS_NATIVE_ADDRESS];

        // ── LAYER 1: chain scope ──────────────────────────────────────────
        const inScope = tokens.filter(t => {
            if (selectedChain && selectedChain.id !== 'all') {
                return t.chainId === selectedChain.id;
            }
            return true;
        });

        // ── LAYER 2: always-allow list (native + TWC) ─────────────────────
        const alwaysAllow = (t: any) => {
            const address = t.address?.toLowerCase() || '';
            const symbol = t.symbol?.toLowerCase() || '';
            const chainInfo = chains?.find((c: any) => c.id === t.chainId);
            const nativeSym = chainInfo?.nativeCurrency?.symbol?.toLowerCase();
            const isNative = NATIVE_ADDRS.includes(address) || (nativeSym && symbol === nativeSym);
            return isNative || address === TWC_ADDRESS;
        };

        // ── LAYER 3: must have a real icon (no icon = fallback = likely scam) ─
        const hasRealIcon = (t: any) => {
            const uri = t.logoURI;
            if (!uri) return false;
            if (typeof uri !== 'string') return false;
            if (uri.trim() === '') return false;
            return true;
        };

        // ── LAYER 4: honeypot / vanity address detector ───────────────────
        // e.g. 0x...4444, 0x...6666, 0x...0000 endings are common honeypot patterns
        const isHoneypotAddress = (address: string) => {
            const clean = address.toLowerCase().replace('0x', '');
            // Repeating last 4 chars (e.g. 4444, 0000, aaaa, 6666)
            const last4 = clean.slice(-4);
            if (/^(.)\1{3}$/.test(last4)) return true;
            // Ends in all zeros (burn address style)
            if (clean.endsWith('000000')) return true;
            return false;
        };

        // ── LAYER 5: spam heuristics ─────────────────────────────────────
        const isSpam = (t: any) => {
            const name = t.name?.toLowerCase() || '';
            const symbol = t.symbol?.toLowerCase() || '';
            const address = t.address?.toLowerCase() || '';

            if (address.endsWith('pump') || name.includes('pump.fun')) return true;
            // Catch more spam keywords including Chinese characters often used for spam
            if (/[\u4e00-\u9fa5]/.test(name) || /[\u4e00-\u9fa5]/.test(symbol)) return true;
            const spamKw = [
                '.com', '.xyz', '.net', '.io', '.org', '.me',
                'claim', 'airdrop', 'visit', 'free', 'reward', 'voucher',
                'gift', 'win', 'bonus', 'ticket', 'receive', 'verify',
                'elon', 'trump', 'safe'
            ];
            if (spamKw.some(k => name.includes(k) || symbol.includes(k))) return true;

            return false;
        };

        // ── LAYER 6: minimum liquidity gate ────────────────────────────────────
        // Some APIs/metadata might not return liquidity. Use a 0 check to allow those,
        // or a very low value just to let legit tokens with 0 liquidity slip past
        // if they pass all other rigorous checks. Duplicate layer handles the rest!
        const hasLiquidity = (t: any) => {
            if (alwaysAllow(t)) return true; // don't gate native/TWC
            if (t.liquidity === undefined || t.liquidity === null) return true; // API didn't give liquidity info, let it pass
            const liq = parseFloat(t.liquidity?.toString() || '0');
            return liq >= 0; // The earlier $100 gate blocked too many legit low-cap tokens
        };

        // ── Apply all layers ──────────────────────────────────────────────
        const filtered = inScope.filter(t => {
            if (alwaysAllow(t)) return true; // sacred list bypasses all checks
            if (!hasRealIcon(t)) return false;
            if (isHoneypotAddress(t.address || '')) return false;
            if (isSpam(t)) return false;
            if (!hasLiquidity(t)) return false;

            // Clear unverified/scam: must be verified OR have significant liquidity ($5000+) OR a sacred entry
            const isVerified = !!(t as any).verified;
            const liq = parseFloat(t.liquidity?.toString() || '0');
            // Gate unverified tokens to have some minimum liquidity (clears zero-liq spam airdrops)
            // Scams usually don't have $5000+ real, sustained liquidity.
            if (!isVerified && liq < 5000) return false;

            return true;
        });

        // ── LAYER 7: deduplicate — same symbol + same chain → keep highest liquidity ─
        const seenSymbolChain = new Map<string, any>();
        filtered.forEach(t => {
            const key = `${t.chainId}-${(t.symbol || '').toUpperCase()}`;
            const existing = seenSymbolChain.get(key);
            if (!existing) {
                seenSymbolChain.set(key, t);
            } else {
                // Prefer: verified > has icon > higher liquidity
                const existingLiq = parseFloat(existing.liquidity?.toString() || '0');
                const newLiq = parseFloat(t.liquidity?.toString() || '0');
                const existingVerified = !!(existing as any).verified;
                const newVerified = !!(t as any).verified;
                if (newVerified && !existingVerified) seenSymbolChain.set(key, t);
                else if (!existingVerified && !newVerified && newLiq > existingLiq) seenSymbolChain.set(key, t);
            }
        });
        const deduped = Array.from(seenSymbolChain.values());

        // ── Map to TokenOption ────────────────────────────────────────────
        const mapped = deduped.map(t => {
            const walletToken = balanceData?.tokens.find(
                wt => wt.address.toLowerCase() === t.address.toLowerCase() && wt.chainId === t.chainId
            );
            const chainInfo = chains?.find((c: any) => c.id === t.chainId);
            const hasBalance = !!walletToken;
            const balanceNum = parseFloat(walletToken?.balanceFormatted || '0');
            const priceNum = parseFloat(t.priceUSD || '0');
            const totalUSD = balanceNum * priceNum;

            return {
                id: `${t.chainId}-${t.address}`,
                symbol: t.symbol,
                name: t.name,
                icon: t.logoURI,
                chainIcon: chainInfo?.logoURI,
                tvl: t.liquidity ? `$${parseFloat(t.liquidity.toString()).toLocaleString()}` : 'N/A',
                balanceFiat: totalUSD > 0 ? formatUSDPrice(totalUSD) : '$0.00',
                balanceToken: hasBalance
                    ? `${formatTokenQuantity(walletToken!.balanceFormatted)} ${t.symbol}`
                    : `0 ${t.symbol}`,
                address: t.address,
                chainId: t.chainId,
                decimals: t.decimals ?? 18,
                priceUSD: t.priceUSD,
                isOwned: hasBalance,
                usdValueNum: totalUSD,
                _liquidity: parseFloat(t.liquidity?.toString() || '0'),
                _verified: !!(t as any).verified,
            } as any;
        });

        // ── Sort: owned first → native → TWC → verified → liquidity ─────
        return mapped.sort((a: any, b: any) => {
            // Owned tokens always first
            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;
            if (a.isOwned && b.isOwned) return b.usdValueNum - a.usdValueNum;

            // Native token next
            const nsym = chains?.find((c: any) => c.id === a.chainId)?.nativeCurrency?.symbol?.toUpperCase();
            const aN = NATIVE_ADDRS.includes(a.address.toLowerCase()) || (nsym && a.symbol.toUpperCase() === nsym);
            const bN = NATIVE_ADDRS.includes(b.address.toLowerCase()) || (nsym && b.symbol.toUpperCase() === nsym);
            if (aN && !bN) return -1;
            if (!aN && bN) return 1;

            // TWC next
            if (a.address.toLowerCase() === TWC_ADDRESS && b.address.toLowerCase() !== TWC_ADDRESS) return -1;
            if (a.address.toLowerCase() !== TWC_ADDRESS && b.address.toLowerCase() === TWC_ADDRESS) return 1;

            // Verified before unverified
            if (a._verified && !b._verified) return -1;
            if (!a._verified && b._verified) return 1;

            // Higher liquidity first
            return b._liquidity - a._liquidity;
        }) as TokenOption[];
    }, [tokens, balanceData, selectedChain, chains, isSearching]);

    // Active list: wallet when browsing, API results when searching
    const tokenOptions = isSearching ? searchTokenOptions : walletTokenOptions;


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

                        {(isLoadingTokens || (isPlaceholderData && tokenOptions.length === 0)) ? (
                            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                                <TokenSkeleton />
                                <TokenSkeleton />
                                <TokenSkeleton />
                                <TokenSkeleton />
                                <TokenSkeleton />
                            </ScrollView>
                        ) : (
                            <FlatList
                                data={tokenOptions}
                                renderItem={renderTokenItem}
                                keyExtractor={item => item.id}
                                style={styles.scroll}
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                initialNumToRender={10}
                                maxToRenderPerBatch={10}
                                windowSize={5}
                            />
                        )}
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
