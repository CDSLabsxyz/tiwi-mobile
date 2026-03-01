import {
    ChainOption,
    ChainSelectSheet,
    ChainSelectorCard,
    ExpiresSection,
    LimitAssetSheet,
    LimitWhenPriceCard,
    SwapConfirmButton,
    SwapDetailsCard,
    SwapDirectionButton,
    SwapHeader,
    SwapLoadingOverlay,
    SwapSettingsSheet,
    SwapSuccessModal,
    SwapTabs,
    SwapTokenCard,
    TokenOption,
    UnifiedAssetSelectSheet
} from '@/components/sections/Swap';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { WalletModal } from '@/components/ui/wallet-modal';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokenPrefetch } from '@/hooks/useTokenPrefetch';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { activityService } from '@/services/activityService';
import { apiClient } from '@/services/apiClient';
import { securityGuard } from '@/services/securityGuard';
import { executeSwap, fetchSwapQuote } from '@/services/swap';
import { useLocaleStore } from '@/store/localeStore';
import { useSecurityStore } from '@/store/securityStore';
import { useSwapStore } from '@/store/swapStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCompactNumber, formatFiatValue, formatTokenAmount } from '@/utils/formatting';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SwapScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams<{
        assetId?: string;
        symbol?: string;
        name?: string;
        balance?: string;
        usdValue?: string;
        chainId?: string;
        logo?: string;
        priceUSD?: string;
    }>();

    // Prefetch top chain tokens
    useTokenPrefetch();

    const { data: chains } = useChains();

    const {
        activeTab,
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        toFiatAmount,
        setActiveTab,
        setFromChain,
        setToChain,
        setFromToken,
        setToToken,
        setFromAmount,
        setToAmount,
        setToFiatAmount,
        swapDirection,
        isFormValid,
        hasValidQuote,
        setSwapQuote,
        swapQuote,
        whenPrice,
        setWhenPrice,
        expiresOption,
        setExpiresOption,
        slippage,
        setSlippage,
        useRelayer,
        setUseRelayer,
        isChainSheetVisible,
        openChainSheet,
        closeChainSheet,
        chainSheetTarget,
    } = useSwapStore();

    const [fromFiatAmount, setFromFiatAmount] = useState('$0.00');

    const { currency, region } = useLocaleStore();

    // UI state
    const {
        isWalletModalVisible: isGlobalWalletModalVisible,
        setWalletModalVisible: setGlobalWalletModalVisible
    } = useWalletStore();
    const [isSettingsSheetVisible, setIsSettingsSheetVisible] = useState(false);
    const [assetSheetTarget, setAssetSheetTarget] = useState<'from' | 'to' | null>(null);
    const [assetSheetInitialStep, setAssetSheetInitialStep] = useState<'chains' | 'tokens'>('chains');
    const [isLimitAssetSheetVisible, setIsLimitAssetSheetVisible] = useState(false);
    const [whenPriceTarget, setWhenPriceTarget] = useState<'from' | 'to'>('to');

    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [isLoadingSwap, setIsLoadingSwap] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

    const { address } = useWalletStore();
    const { isTransactionRiskEnabled } = useSecurityStore();
    const { data: balanceData } = useWalletBalances();

    // 1. Sync Balances for selected tokens
    useEffect(() => {
        if (!balanceData) return;

        if (fromToken) {
            const walletToken = balanceData.tokens.find(
                t => t.address.toLowerCase() === fromToken.address?.toLowerCase() && t.chainId === fromToken.chainId
            );
            if (walletToken) {
                setFromToken({
                    ...fromToken,
                    balanceToken: `${parseFloat(walletToken.balanceFormatted || '0').toFixed(6)} ${fromToken.symbol}`,
                    balanceFiat: `$${parseFloat(walletToken.usdValue || '0').toFixed(2)}`
                });
            }
        }

        if (toToken) {
            const walletToken = balanceData.tokens.find(
                t => t.address.toLowerCase() === toToken.address?.toLowerCase() && t.chainId === toToken.chainId
            );
            if (walletToken) {
                setToToken({
                    ...toToken,
                    balanceToken: `${parseFloat(walletToken.balanceFormatted || '0').toFixed(6)} ${toToken.symbol}`,
                    balanceFiat: `$${parseFloat(walletToken.usdValue || '0').toFixed(2)}`
                });
            }
        }
    }, [balanceData, fromToken?.address, fromToken?.chainId, toToken?.address, toToken?.chainId]);

    // 2. Fetch Prices Updates (BNB & TWC) silently in background
    useEffect(() => {
        const updatePrices = async () => {
            try {
                // Silently update chain icons if missing
                if (chains && fromChain && !fromChain.icon) {
                    const real = chains.find(c => c.id === fromChain.id);
                    if (real) setFromChain({ ...fromChain, icon: real.logoURI || real.logo });
                }
                if (chains && toChain && !toChain.icon) {
                    const real = chains.find(c => c.id === toChain.id);
                    if (real) setToChain({ ...toChain, icon: real.logoURI || real.logo });
                }

                // Silently update token info if it's our defaults
                const isDefaultBnb = fromToken?.address === "0x0000000000000000000000000000000000000000";
                const isDefaultTwc = toToken?.address === "0xDA1060158F7D593667CCE0A15DB346BB3FfB3596";

                if (isDefaultBnb || isDefaultTwc) {
                    const [bnbRes, twcRes] = await Promise.all([
                        apiClient.getTokens({ query: '0x0000000000000000000000000000000000000000', chains: [56], limit: 1 }),
                        apiClient.getTokens({ query: '0xDA1060158F7D593667CCE0A15DB346BB3FFB3596', chains: [56], limit: 1 })
                    ]);

                    if (isDefaultBnb && bnbRes.tokens?.[0]) {
                        const bnb = bnbRes.tokens[0];
                        setFromToken({ ...fromToken!, priceUSD: bnb.priceUSD, tvl: bnb.marketCap ? `$${formatCompactNumber(bnb.marketCap)}` : fromToken!.tvl });
                    }
                    if (isDefaultTwc && twcRes.tokens?.[0]) {
                        const twc = twcRes.tokens[0];
                        setToToken({ ...toToken!, priceUSD: twc.priceUSD, tvl: twc.marketCap ? `$${formatCompactNumber(twc.marketCap)}` : toToken!.tvl });
                    }
                }
            } catch (err) {
                console.warn('[SwapScreen] Background price update failed:', err);
            }
        };

        updatePrices();
    }, [chains, fromChain?.id, toChain?.id]);

    // 2. Pre-populate from params if coming from asset detail
    useEffect(() => {
        if (params.symbol && params.chainId && chains) {
            const chain = chains.find(c => String(c.id) === params.chainId);

            if (chain) {
                const chainOption = {
                    id: chain.id,
                    name: chain.name,
                    icon: chain.logoURI || chain.logo
                };
                setFromChain(chainOption);
                setFromToken({
                    id: params.assetId || params.symbol,
                    symbol: params.symbol,
                    name: params.name || params.symbol,
                    icon: params.logo,
                    balanceToken: params.balance || '0.00',
                    balanceFiat: params.usdValue || '$0.00',
                    priceUSD: params.priceUSD || '0',
                    address: params.assetId || '',
                    chainId: chainOption.id,
                    decimals: 18 // Default
                } as any);
            }
        }
    }, [params.symbol, params.chainId, chains]);

    const handleOpenAssetSheet = (target: 'from' | 'to', initialStep: 'chains' | 'tokens' = 'tokens') => {
        setAssetSheetTarget(target);
        setAssetSheetInitialStep(initialStep);
    };

    const handleCloseAssetSheet = () => setAssetSheetTarget(null);

    const handleAssetSelect = (chain: ChainOption, token: TokenOption) => {
        if (assetSheetTarget === 'from') {
            setFromChain(chain);
            setFromToken(token);
        } else {
            setToChain(chain);
            setToToken(token);
        }
        setFromAmount('');
        setToAmount('');
        setFromFiatAmount('$0.00');
        setToFiatAmount('$0.00');
        setSwapQuote(null);
        handleCloseAssetSheet();
    };

    const handleChainOptionSelect = (option: any) => {
        const chain: ChainOption = {
            id: option.id,
            name: option.name,
            icon: option.icon,
        };

        if (chainSheetTarget === 'from') {
            setFromChain(chain);
        } else if (chainSheetTarget === 'to') {
            setToChain(chain);
        }
        setSwapQuote(null);
        closeChainSheet();
    };

    const handleLimitAssetSelect = (target: 'from' | 'to') => {
        setWhenPriceTarget(target);
        setIsLimitAssetSheetVisible(false);
    };


    const handleSwapDirection = () => {
        swapDirection();
    };

    const updateQuote = useCallback(async (isRefresh = false) => {
        if (!fromAmount || parseFloat(fromAmount) <= 0 || !fromToken || !toToken) {
            setSwapQuote(null);
            setToAmount('');
            setToFiatAmount('$0.00');
            setLastFetchTime(0);
            setIsStale(false);
            return;
        }

        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoadingQuote(true);
            setIsStale(false); // Reset stale on manual change
        }
        try {
            const fetchedQuote = await fetchSwapQuote(fromAmount, fromToken, toToken, address || '', address || '', slippage);

            if (fetchedQuote) {
                setSwapQuote(fetchedQuote);
                setLastFetchTime(Date.now());
                setToAmount(fetchedQuote.toAmount);
                setIsStale(false);

                // Calculate To Fiat using toToken.priceUSD
                if (toToken.priceUSD && parseFloat(fetchedQuote.toAmount) > 0) {
                    const toUsdValue = parseFloat(fetchedQuote.toAmount) * parseFloat(toToken.priceUSD);
                    setToFiatAmount(formatFiatValue(toUsdValue, region, currency));
                } else {
                    setToFiatAmount('$0.00');
                }
            }
        } catch (error) {
            console.error('Failed to fetch quote:', error);
            // Don't clear quote on background refresh failure, just mark as stale
            if (!isRefresh) {
                setSwapQuote(null);
            }
            setIsStale(true);
        } finally {
            setIsLoadingQuote(false);
            setIsRefreshing(false);
        }
    }, [fromAmount, fromToken, toToken, address, region, currency]);

    useEffect(() => {
        // Only run initial fetch if values actually changed
        const timer = setTimeout(() => {
            updateQuote(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [fromAmount, fromToken, toToken, updateQuote]);

    // 60-second Heartbeat Auto-Refresh
    useEffect(() => {
        if (!swapQuote || isLoadingQuote || isRefreshing || isLoadingSwap) return;

        const interval = setInterval(() => {
            console.log("[Swap] 60s passed, refreshing quote...");
            updateQuote(true);
        }, 60000);

        return () => clearInterval(interval);
    }, [swapQuote, isLoadingQuote, isRefreshing, isLoadingSwap, updateQuote]);

    // Update From Fiat whenever amount or token changes
    useEffect(() => {
        if (!fromAmount || !fromToken?.priceUSD || parseFloat(fromAmount) === 0) {
            setFromFiatAmount('$0.00');
            return;
        }
        try {
            const usdValue = parseFloat(fromAmount) * parseFloat(fromToken.priceUSD);
            setFromFiatAmount(formatFiatValue(usdValue, region, currency));
        } catch (e) {
            setFromFiatAmount('$0.00');
        }
    }, [fromAmount, fromToken, region, currency]);

    const handleConfirmSwap = async () => {
        if (!fromAmount || !fromToken || !toToken || !address) return;

        // Security Check: Token Risk
        if (isTransactionRiskEnabled) {
            setIsLoadingSwap(true);
            try {
                const toTokenRisk = await securityGuard.checkTokenRisk(toToken.address, fromChain?.id.toString() || '1');
                if (!toTokenRisk.isSafe) {
                    setIsLoadingSwap(false);
                    Alert.alert(
                        'Security Warning',
                        `Tiwi Protocol detected risks with ${toToken.symbol}:\n\n${toTokenRisk.warnings.join('\n')}\n\nDo you want to proceed anyway?`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Proceed',
                                style: 'destructive',
                                onPress: () => performExecution()
                            }
                        ]
                    );
                    return;
                }
            } catch (e) {
                console.error('Security check failed:', e);
            }
        }

        performExecution();
    };

    const performExecution = async () => {
        if (!fromAmount || !fromToken || !toToken || !address) return;
        setIsLoadingSwap(true);
        try {
            if (!swapQuote) throw new Error('No swap quote available');
            const result = await executeSwap(fromAmount, fromToken, toToken, address, address, swapQuote);

            // Log transaction to backend
            const txHash = result?.txHash || `mock-hash-e${Date.now()}`;
            const chainId = typeof fromChain?.id === 'number' ? fromChain.id : 56;

            await apiClient.logTransaction({
                walletAddress: address,
                transactionHash: txHash,
                chainId: chainId,
                type: 'Swap',
                fromTokenAddress: fromToken.address,
                fromTokenSymbol: fromToken.symbol,
                toTokenAddress: toToken.address,
                toTokenSymbol: toToken.symbol,
                amount: fromAmount,
                amountFormatted: `${fromAmount} ${fromToken.symbol}`,
                usdValue: parseFloat(toFiatAmount.replace('$', '').replace(',', '')),
                routerName: swapQuote?.source?.[0] || 'Tiwi Router',
            });

            // Log activity to user-facing activity log
            await activityService.logTransaction(
                address,
                activeTab === 'limit' ? 'swap' : 'swap', // Unified type for activity log
                activeTab === 'limit' ? 'Limit Order Placed' : 'Swap Successful',
                `You swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
                txHash
            );

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
        setFromFiatAmount('$0.00');
        setToFiatAmount('$0.00');
        setSwapQuote(null);
    };

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            <View style={styles.flex1}>
                <WalletModal
                    visible={isGlobalWalletModalVisible}
                    onClose={() => setGlobalWalletModalVisible(false)}
                    onHistoryPress={() => { setGlobalWalletModalVisible(false); router.push('/wallet' as any); }}
                    onSettingsPress={() => { setGlobalWalletModalVisible(false); router.push('/settings' as any); }}
                    onDisconnectPress={() => { setGlobalWalletModalVisible(false); }}
                />

                <SwapSettingsSheet
                    visible={isSettingsSheetVisible}
                    onClose={() => setIsSettingsSheetVisible(false)}
                />

                <ChainSelectSheet
                    visible={isChainSheetVisible}
                    selectedChainId={chainSheetTarget === 'from' ? fromChain?.id : toChain?.id}
                    onSelect={handleChainOptionSelect}
                    onClose={closeChainSheet}
                />

                <UnifiedAssetSelectSheet
                    visible={!!assetSheetTarget}
                    initialStep={assetSheetInitialStep}
                    initialChainId={
                        assetSheetTarget === 'from' ? fromChain?.id :
                            assetSheetTarget === 'to' ? toChain?.id : null
                    }
                    selectedTokenId={
                        assetSheetTarget === 'from' ? fromToken?.id :
                            assetSheetTarget === 'to' ? toToken?.id : null
                    }
                    onSelect={handleAssetSelect}
                    onClose={handleCloseAssetSheet}
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
                    <SwapHeader
                        onWalletPress={() => setGlobalWalletModalVisible(true)}
                        onSettingsPress={() => setIsSettingsSheetVisible(true)}
                    />

                    <View style={styles.contentPadding}>
                        <SwapTabs activeTab={activeTab} onChange={setActiveTab} />

                        <View style={styles.spacerLarge} />

                        <ChainSelectorCard
                            chainName={fromChain?.name || 'Select Chain'}
                            chainIcon={fromChain?.icon || require('@/assets/home/chains/ethereum.svg')}
                            onPress={() => openChainSheet('from')}
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
                                fiatAmount={fromFiatAmount}
                                balanceText={fromToken?.balanceToken || '0.00'}
                                onAmountChange={setFromAmount}
                                onTokenPress={() => handleOpenAssetSheet('from', 'tokens')}
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
                                    amount={formatTokenAmount(toAmount)}
                                    fiatAmount={toFiatAmount}
                                    balanceText={toToken?.balanceToken || '0.00'}
                                    onTokenPress={() => handleOpenAssetSheet('to', 'tokens')}
                                    isLoadingQuote={isLoadingQuote}
                                    isRefreshing={isRefreshing}
                                    isStale={isStale}
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
                            slippageTolerance={`${swapQuote?.slippage || slippage}%`}
                            twcFee={swapQuote?.twcFee}
                            source={swapQuote?.source}
                            isLoading={isLoadingQuote}
                            isRefreshing={isRefreshing}
                            isStale={isStale}
                            lastFetchTime={lastFetchTime}
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
                            disabled={!isFormValid() || !swapQuote || isLoadingSwap || isRefreshing || isLoadingQuote}
                            loading={isLoadingSwap}
                            onPress={handleConfirmSwap}
                            isRefreshing={isRefreshing}
                            isStale={isStale}
                            activeTab={activeTab}
                            hasValidQuote={hasValidQuote()}
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
        paddingBottom: 40
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
