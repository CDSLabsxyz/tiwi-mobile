import { TokenSkeleton } from '@/components/ui/TokenSkeleton';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokens } from '@/hooks/useTokens';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { getColorFromSeed, } from '@/utils/formatting';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectionBottomSheet } from './SelectionBottomSheet';

// Reuse types from existing sheets
import { truncateAddress } from '@/utils/wallet';
import type { ChainId, ChainOption } from './ChainSelectSheet';
import type { TokenOption } from './TokenSelectSheet';

const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');

interface UnifiedAssetSelectSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (chain: ChainOption, token: TokenOption) => void;
    initialChainId?: ChainId | null;
    selectedTokenId?: string | null;
}

type SelectionStep = 'chains' | 'tokens';

export const UnifiedAssetSelectSheet: React.FC<UnifiedAssetSelectSheetProps> = ({
    visible,
    onClose,
    onSelect,
    initialChainId,
    selectedTokenId,
}) => {
    const [step, setStep] = useState<SelectionStep>('chains');
    const [selectedChain, setSelectedChain] = useState<ChainOption | null>(null);
    const [tokenSearchQuery, setTokenSearchQuery] = useState('');
    const [chainSearchQuery, setChainSearchQuery] = useState('');

    const { data: chains, isLoading: isLoadingChains } = useChains();
    const { data: balanceData } = useWalletBalances();

    // Reset state when opening
    useEffect(() => {
        if (visible) {
            if (initialChainId) {
                const chain = chains?.find(c => c.id === initialChainId);
                if (chain) {
                    setSelectedChain({
                        id: chain.id,
                        name: chain.name,
                        icon: chain.logoURI || chain.logo || require('@/assets/home/chains/ethereum.svg'),
                    });
                    setStep('tokens');
                } else {
                    setStep('chains');
                }
            } else {
                setStep('chains');
                setSelectedChain(null);
            }
            setTokenSearchQuery('');
            setChainSearchQuery('');
        }
    }, [visible, initialChainId, chains]);

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
    const { data: tokens, isLoading: isLoadingTokens } = useTokens({
        query: tokenSearchQuery,
        chains: selectedChain ? [selectedChain.id as number] : undefined,
    });

    const tokenOptions: TokenOption[] = useMemo(() => {
        if (!tokens) return [];
        return tokens.map(t => {
            const walletToken = balanceData?.tokens.find(
                wt => wt.address.toLowerCase() === t.address.toLowerCase() && wt.chainId === t.chainId
            );

            return {
                id: `${t.chainId}-${t.address}`,
                symbol: t.symbol,
                name: t.name,
                icon: t.logoURI,
                tvl: t.liquidity ? `$${t.liquidity.toLocaleString()}` : 'N/A',
                balanceFiat: walletToken?.usdValue ? `$${parseFloat(walletToken.usdValue).toFixed(2)}` : '$0.00',
                balanceToken: walletToken?.balanceFormatted || `0.00 ${t.symbol}`,
                address: t.address,
                chainId: t.chainId,
                decimals: t.decimals,
            };
        });
    }, [tokens, balanceData]);

    const handleChainSelect = (chain: any) => {
        setSelectedChain({
            id: chain.id,
            name: chain.name,
            icon: chain.icon,
        });
        setStep('tokens');
    };

    const handleTokenSelect = (token: TokenOption) => {
        if (selectedChain) {
            onSelect(selectedChain, token);
        }
    };

    const handleBack = () => {
        setStep('chains');
        setTokenSearchQuery('');
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
            <View style={styles.content}>
                {step === 'tokens' && (
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
                )}

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 'chains' ? (
                        isLoadingChains ? (
                            <View style={styles.loaderContainer}>
                                <ActivityIndicator color={colors.primaryCTA} />
                            </View>
                        ) : (
                            filteredChains.map((chain) => (
                                <TouchableOpacity
                                    key={chain.id}
                                    style={styles.chainItem}
                                    activeOpacity={0.8}
                                    onPress={() => handleChainSelect(chain)}
                                >
                                    <View style={styles.chainIconWrapper}>
                                        <Image source={chain.icon} style={styles.fullSize} contentFit="contain" />
                                    </View>
                                    <Text style={styles.chainName}>{chain.name}</Text>
                                    {selectedChain?.id === chain.id && (
                                        <Ionicons name="checkmark-circle" size={24} color={colors.primaryCTA} style={styles.checkIcon} />
                                    )}
                                </TouchableOpacity>
                            ))
                        )
                    ) : (
                        isLoadingTokens ? (
                            <>
                                <TokenSkeleton />
                                <TokenSkeleton />
                                <TokenSkeleton />
                                <TokenSkeleton />
                                <TokenSkeleton />
                            </>
                        ) : (
                            tokenOptions.map((token) => {
                                const isActive = token.id === selectedTokenId;
                                return (
                                    <TouchableOpacity
                                        key={token.id}
                                        activeOpacity={0.9}
                                        onPress={() => handleTokenSelect(token)}
                                        style={[styles.tokenItem, isActive && styles.activeTokenItem]}
                                    >
                                        <View style={styles.tokenContent}>
                                            <View style={styles.leftInfo}>
                                                <View style={styles.tokenIconWrapper}>
                                                    {token.icon ? (
                                                        <Image source={token.icon} style={styles.fullSize} contentFit="contain" />
                                                    ) : (
                                                        <View style={[styles.fallbackCircle, { backgroundColor: getColorFromSeed(token.symbol) }]}>
                                                            <Text style={styles.fallbackText}>{token.symbol.charAt(0).toUpperCase()}</Text>
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
                            })
                        )
                    )}
                </ScrollView>
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
        overflow: 'hidden',
        backgroundColor: colors.bgSemi,
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
