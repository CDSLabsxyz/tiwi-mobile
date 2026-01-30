import {
    ChainOption,
    ChainSelectorCard,
    ChainSelectSheet,
    ExpiresOption,
    ExpiresSection,
    LimitAssetSheet,
    LimitWhenPriceCard,
    SwapConfirmButton,
    SwapDetailsCard,
    SwapDirectionButton,
    SwapHeader,
    SwapLoadingOverlay,
    SwapSuccessModal,
    SwapTabKey,
    SwapTabs,
    SwapTokenCard,
    TokenOption,
    TokenSelectSheet
} from '@/components/sections/Swap';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { WalletModal } from '@/components/ui/wallet-modal';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokenPrefetch } from '@/hooks/useTokenPrefetch';
import { executeSwap, fetchSwapQuote, SwapQuote } from '@/services/swap';
import { useWalletStore } from '@/store/walletStore';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SwapScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();

    // Prefetch top chain tokens
    useTokenPrefetch();

    const { data: chains } = useChains();

    // --- State Management ---
    const [activeTab, setActiveTab] = useState<SwapTabKey>('swap');
    const [fromChain, setFromChain] = useState<ChainOption | null>({
        id: 56, // BNB Chain as default (matching web app preference)
        name: 'BNB Chain',
        icon: require('@/assets/home/tiwicat-token.svg'),
    });
    const [toChain, setToChain] = useState<ChainOption | null>(null);
    const [fromToken, setFromToken] = useState<TokenOption | null>({
        id: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596', // Real TWC address
        symbol: 'TWC',
        name: 'TIWI CAT',
        icon: require('@/assets/home/tiwicat-token.svg'),
        tvl: '$0',
        balanceFiat: '$0',
        balanceToken: '0.00 TWC',
        address: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
        chainId: 56,
        decimals: 9
    });
    const [toToken, setToToken] = useState<TokenOption | null>(null);
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [toFiatAmount, setToFiatAmount] = useState('$0.00');

    // Sync real chain icons when fetched
    useEffect(() => {
        if (chains) {
            if (fromChain && !fromChain.icon?.uri) {
                const real = chains.find(c => c.id === fromChain.id);
                if (real?.logoURI) {
                    setFromChain(prev => prev ? { ...prev, icon: real.logoURI } : null);
                }
            }
            if (toChain && !toChain.icon?.uri) {
                const real = chains.find(c => c.id === toChain.id);
                if (real?.logoURI) {
                    setToChain(prev => prev ? { ...prev, icon: real.logoURI } : null);
                }
            }
        }
    }, [chains, fromChain?.id, toChain?.id]);

    // Limit specific state
    const [whenPrice, setWhenPrice] = useState('');
    const [expiresOption, setExpiresOption] = useState<ExpiresOption>('never');

    // UI state
    const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
    const [chainSheetTarget, setChainSheetTarget] = useState<'from' | 'to' | null>(null);
    const [tokenSheetTarget, setTokenSheetTarget] = useState<'from' | 'to' | null>(null);
    const [isLimitAssetSheetVisible, setIsLimitAssetSheetVisible] = useState(false);
    const [whenPriceTarget, setWhenPriceTarget] = useState<'from' | 'to'>('to');

    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [isLoadingSwap, setIsLoadingSwap] = useState(false);
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
    const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);

    const { address } = useWalletStore();

    const handleOpenTokenSheet = (target: 'from' | 'to') => {
        // Enforce flow: Select Chain first, THEN Token selection sheet will open
        setChainSheetTarget(target);
    };

    const handleCloseChainSheet = () => setChainSheetTarget(null);

    const handleCloseTokenSheet = () => {
        setTokenSheetTarget(null);
        setChainSheetTarget(null);
    };

    const handleLimitAssetSelect = (target: 'from' | 'to') => {
        setWhenPriceTarget(target);
        setIsLimitAssetSheetVisible(false);
    };

    const handleChainSelect = (option: ChainOption) => {
        if (chainSheetTarget === 'from') {
            setFromChain(option);
            if (fromToken?.chainId !== option.id) {
                setFromToken(null);
            }
        } else if (chainSheetTarget === 'to') {
            setToChain(option);
            if (toToken?.chainId !== option.id) {
                setToToken(null);
            }
        }

        // Move to the next step: show token selection for this chain
        const currentTarget = chainSheetTarget;
        handleCloseChainSheet();

        // Use a small timeout to allow the previous sheet to close cleanly
        setTimeout(() => {
            if (currentTarget) setTokenSheetTarget(currentTarget);
        }, 300);
    };

    const handleTokenSelect = (token: TokenOption) => {
        if (tokenSheetTarget === 'from') setFromToken(token);
        else if (tokenSheetTarget === 'to') setToToken(token);

        handleCloseTokenSheet();
    };

    const handleSwapDirection = () => {
        const tempChain = fromChain;
        setFromChain(toChain);
        setToChain(tempChain);

        const tempToken = fromToken;
        setFromToken(toToken);
        setToToken(tempToken);

        const tempAmount = fromAmount;
        setFromAmount(toAmount);
        setToAmount(tempAmount);
    };

    const updateQuote = useCallback(async () => {
        if (!fromAmount || parseFloat(fromAmount) <= 0 || !fromToken || !toToken) {
            setSwapQuote(null);
            setToAmount('');
            setToFiatAmount('$0.00');
            return;
        }

        setIsLoadingQuote(true);
        try {
            const quote = await fetchSwapQuote(fromAmount, fromToken, toToken, address || undefined);
            setSwapQuote(quote);
            setToAmount(quote.toAmount);
            setToFiatAmount(quote.fiatAmount);
        } catch (error) {
            console.error('Failed to fetch quote:', error);
        } finally {
            setIsLoadingQuote(false);
        }
    }, [fromAmount, fromToken, toToken, address]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updateQuote();
        }, 500);
        return () => clearTimeout(timer);
    }, [fromAmount, fromToken, toToken, updateQuote]);

    const handleConfirmSwap = async () => {
        if (!fromAmount || !fromToken || !toToken || !address) return;

        setIsLoadingSwap(true);
        try {
            const result = await executeSwap(fromAmount, fromToken, toToken, address);

            // Log transaction to backend
            const { apiClient } = require('@/services/apiClient');
            await apiClient.logTransaction({
                walletAddress: address,
                transactionHash: result?.txHash || `mock-hash-${Date.now()}`,
                chainId: typeof fromChain?.id === 'number' ? fromChain.id : 56,
                type: activeTab === 'limit' ? 'limit_order' : 'swap',
                fromTokenAddress: fromToken.address,
                fromTokenSymbol: fromToken.symbol,
                toTokenAddress: toToken.address,
                toTokenSymbol: toToken.symbol,
                amount: fromAmount,
                amountFormatted: `${fromAmount} ${fromToken.symbol}`,
                usdValue: parseFloat(toFiatAmount.replace('$', '').replace(',', '')),
                routerName: swapQuote?.source?.[0] || 'Tiwi Router',
            });

            setIsLoadingSwap(false);
            setIsSuccessModalVisible(true);
        } catch (error) {
            console.error('Swap execution failed:', error);
            setIsLoadingSwap(false);
        }
    };

    const handleSuccessDone = () => {
        setIsSuccessModalVisible(false);
        setFromAmount('');
        setToAmount('');
        router.back();
    };

    const isFormValid = () => {
        if (activeTab === 'swap') {
            return !!fromAmount && !!fromToken && !!toToken;
        } else {
            return !!fromAmount && !!fromToken && !!toToken && !!whenPrice;
        }
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            <View style={styles.flex1}>
                <WalletModal
                    visible={isWalletModalVisible}
                    onClose={() => setIsWalletModalVisible(false)}
                    onHistoryPress={() => { setIsWalletModalVisible(false); router.push('/wallet' as any); }}
                    onSettingsPress={() => { setIsWalletModalVisible(false); router.push('/settings' as any); }}
                    onDisconnectPress={() => { setIsWalletModalVisible(false); }}
                />

                <ChainSelectSheet
                    visible={!!chainSheetTarget}
                    selectedChainId={
                        chainSheetTarget === 'from' ? fromChain?.id || null :
                            chainSheetTarget === 'to' ? toChain?.id || null : null
                    }
                    onSelect={handleChainSelect}
                    onClose={handleCloseChainSheet}
                />

                <TokenSelectSheet
                    visible={!!tokenSheetTarget}
                    chainId={
                        tokenSheetTarget === 'from' ? fromChain?.id || null :
                            tokenSheetTarget === 'to' ? toChain?.id || null : null
                    }
                    selectedTokenId={
                        tokenSheetTarget === 'from' ? fromToken?.id || null :
                            tokenSheetTarget === 'to' ? toToken?.id || null : null
                    }
                    onSelect={handleTokenSelect}
                    onClose={handleCloseTokenSheet}
                />

                <LimitAssetSheet
                    visible={isLimitAssetSheetVisible}
                    fromToken={fromToken}
                    toToken={toToken}
                    fromChainName={fromChain?.name}
                    toChainName={toChain?.name}
                    fromChainIcon={fromChain?.icon}
                    toChainIcon={toChain?.icon}
                    selectedTarget={whenPriceTarget}
                    onClose={() => setIsLimitAssetSheetVisible(false)}
                    onSelect={handleLimitAssetSelect}
                />

                <SwapLoadingOverlay visible={isLoadingSwap} />

                <SwapSuccessModal
                    visible={isSuccessModalVisible}
                    onDone={handleSuccessDone}
                    activeTab={activeTab}
                />

                <ScrollView
                    style={styles.flex1}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: (bottom || 16) + 32 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <SwapHeader onWalletPress={() => setIsWalletModalVisible(true)} />

                    <View style={styles.contentPadding}>
                        <SwapTabs activeTab={activeTab} onChange={setActiveTab} />

                        <View style={styles.spacerLarge} />

                        <ChainSelectorCard
                            chainName={fromChain?.name || 'Select Chain'}
                            chainIcon={fromChain?.icon || require('@/assets/home/chains/ethereum.svg')}
                        // onPress={() => handleOpenChainSheet('from')}
                        />

                        <View style={styles.sectionLabelWrapper}>
                            <Text style={styles.sectionLabel}>Token</Text>
                        </View>

                        <View style={styles.cardsContainer}>
                            <SwapTokenCard
                                variant="from"
                                tokenSelected={!!fromToken}
                                tokenSymbol={fromToken?.symbol}
                                tokenChain={fromChain?.name || 'Select Chain'}
                                tokenIcon={fromToken?.icon}
                                chainBadgeIcon={fromChain?.icon}
                                amount={fromAmount}
                                fiatAmount={fromToken?.balanceFiat || "$0.00"}
                                balanceText={fromToken?.balanceToken || '0.00'}
                                onAmountChange={setFromAmount}
                                onTokenPress={() => handleOpenTokenSheet('from')}
                                onMaxPress={() => {
                                    const bal = fromToken?.balanceToken?.split(' ')[0] || '0';
                                    setFromAmount(bal);
                                }}
                            />

                            <View style={styles.toCardWrapper}>
                                <SwapTokenCard
                                    variant="to"
                                    tokenSelected={!!toToken}
                                    tokenSymbol={toToken?.symbol}
                                    tokenChain={toChain?.name}
                                    tokenIcon={toToken?.icon}
                                    chainBadgeIcon={toChain?.icon}
                                    amount={toAmount}
                                    fiatAmount={toFiatAmount}
                                    balanceText={toToken ? '0.00' : '0.00'}
                                    onTokenPress={() => handleOpenTokenSheet('to')}
                                    isLoadingQuote={isLoadingQuote}
                                />
                            </View>

                            <SwapDirectionButton onPress={handleSwapDirection} />
                        </View>

                        {activeTab === 'limit' && (
                            <View style={styles.limitExtraWrapper}>
                                <LimitWhenPriceCard
                                    tokenSymbol={whenPriceTarget === 'from' ? fromToken?.symbol : toToken?.symbol}
                                    tokenSelected={whenPriceTarget === 'from' ? !!fromToken : !!toToken}
                                    tokenIcon={whenPriceTarget === 'from' ? fromToken?.icon : toToken?.icon}
                                    chainBadgeIcon={whenPriceTarget === 'from' ? fromChain?.icon : toChain?.icon}
                                    amount={whenPrice}
                                    fiatAmount="$0.00"
                                    balanceText={whenPriceTarget === 'from' ? (fromToken?.balanceToken || '0.00') : (toToken?.balanceToken || '0.00')}
                                    onAmountChange={setWhenPrice}
                                    onTokenPress={() => setIsLimitAssetSheetVisible(true)}
                                />
                            </View>
                        )}

                        <SwapDetailsCard
                            gasFee={swapQuote?.gasFee}
                            slippageTolerance={`${swapQuote?.slippage || 0}%`}
                            twcFee={swapQuote?.twcFee}
                            source={swapQuote?.source}
                            isLoading={isLoadingQuote}
                        />

                        {activeTab === 'limit' && (
                            <View style={styles.expiresWrapper}>
                                <ExpiresSection
                                    selectedOption={expiresOption}
                                    onSelect={setExpiresOption}
                                />
                            </View>
                        )}

                        <View style={styles.spacerLarge} />

                        <SwapConfirmButton
                            disabled={!isFormValid() || isLoadingSwap}
                            loading={isLoadingSwap}
                            onPress={handleConfirmSwap}
                            activeTab={activeTab}
                            hasValidQuote={!!swapQuote}
                        />
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    flex1: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    contentPadding: {
        paddingHorizontal: 20,
        alignItems: 'center',
        width: '100%',
    },
    spacerLarge: {
        marginTop: 32,
    },
    sectionLabelWrapper: {
        width: '100%',
        marginBottom: 16,
        marginTop: 32,
    },
    sectionLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        lineHeight: 14,
    },
    cardsContainer: {
        width: '100%',
        position: 'relative',
        gap: 4
    },
    toCardWrapper: {
        marginTop: 4,
    },
    limitExtraWrapper: {
        marginTop: 6,
        width: '100%',
    },
    expiresWrapper: {
        marginTop: 16,
        width: '100%',
    },
});
