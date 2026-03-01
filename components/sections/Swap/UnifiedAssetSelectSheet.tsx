import { TokenSkeleton } from '@/components/ui/TokenSkeleton';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokens } from '@/hooks/useTokens';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { getColorFromSeed, } from '@/utils/formatting';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SelectionBottomSheet } from './SelectionBottomSheet';

// Reuse types from existing sheets
import { truncateAddress } from '@/utils/wallet';
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
                        icon: chain.logoURI || chain.logo || require('@/assets/home/chains/ethereum.svg'),
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
            icon: c.logoURI || c.logo || require('@/assets/home/chains/ethereum.svg'),
            symbol: c.symbol
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

    const {
        data: response,
        isLoading: isLoadingTokens,
        isFetching: isFetchingTokens,
        isPlaceholderData
    } = useTokens({
        query: debouncedQuery,
        chains: stableChains,
    });
    const tokens = response?.tokens;

    const tokenOptions: TokenOption[] = useMemo(() => {
        if (!tokens) return [];

        // Strict client-side filtering to ensure placeholders/cache don't show tokens from other chains
        const filteredTokens = (selectedChain && selectedChain.id !== 'all')
            ? tokens.filter(t => t.chainId === selectedChain.id)
            : tokens;

        const TWC_ADDRESS = '0xda1060158f7d593667cce0a15db346bb3ffb3596'.toLowerCase();

        const mapped = filteredTokens.map(t => {
            const walletToken = balanceData?.tokens.find(
                wt => wt.address.toLowerCase() === t.address.toLowerCase() && wt.chainId === t.chainId
            );

            // Find chain logo for the badge
            const chainInfo = chains?.find(c => c.id === t.chainId);
            const chainIcon = chainInfo?.logoURI || chainInfo?.logo;

            return {
                id: `${t.chainId}-${t.address}`,
                symbol: t.symbol,
                name: t.name,
                icon: t.logoURI,
                chainIcon: chainIcon,
                tvl: t.liquidity ? `$${t.liquidity.toLocaleString()}` : 'N/A',
                balanceFiat: walletToken?.usdValue ? `$${parseFloat(walletToken.usdValue).toFixed(2)}` : '$0.00',
                balanceToken: walletToken?.balanceFormatted || `0.00 ${t.symbol}`,
                address: t.address,
                chainId: t.chainId,
                decimals: t.decimals,
                priceUSD: t.priceUSD,
                isOwned: !!walletToken,
                usdValueNum: parseFloat(walletToken?.usdValue || '0'),
            };
        });

        // Sorting Logic:
        // 1. TWC always at the absolute top
        // 2. Owned tokens (balance > 0)
        // 3. Others (by liquidity/API default)
        return mapped.sort((a, b) => {
            const isATWC = a.address.toLowerCase() === TWC_ADDRESS;
            const isBTWC = b.address.toLowerCase() === TWC_ADDRESS;
            if (isATWC) return -1;
            if (isBTWC) return 1;

            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;

            if (a.isOwned && b.isOwned) {
                return b.usdValueNum - a.usdValueNum;
            }

            return 0; // Maintain API order for others
        });
    }, [tokens, balanceData, selectedChain, chains]);

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
                        icon: actualChain.logoURI || actualChain.logo || AllChainsIcon
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
                        <View style={styles.tokenIconWrapper}>
                            {token.icon ? (
                                <ExpoImage source={token.icon} style={styles.fullSize} contentFit="cover" />
                            ) : (
                                <View style={[styles.fallbackCircle, { backgroundColor: getColorFromSeed(token.symbol) }]}>
                                    <Text style={styles.fallbackText}>{token.symbol.charAt(0).toUpperCase()}</Text>
                                </View>
                            )}

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
                        <Text style={styles.fiatBalance}>{token.balanceFiat}</Text>
                        <Text style={styles.tokenBalance}>{token.balanceToken}</Text>
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
    tokenIconWrapper: {
        width: 40,
        height: 40,
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
    fiatBalance: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    tokenBalance: {
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
