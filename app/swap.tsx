import {
    ChainOption,
    ChainSelectorCard,
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
    UnifiedAssetSelectSheet
} from '@/components/sections/Swap';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { WalletModal } from '@/components/ui/wallet-modal';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokenPrefetch } from '@/hooks/useTokenPrefetch';
import { activityService } from '@/services/activityService';
import { securityGuard } from '@/services/securityGuard';
import { executeSwap, fetchSwapQuote, SwapQuote } from '@/services/swap';
import { useLocaleStore } from '@/store/localeStore';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { formatFiatValue, formatTokenAmount } from '@/utils/formatting';
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

    // --- State Management ---
    const [activeTab, setActiveTab] = useState<SwapTabKey>('swap');
    const [fromChain, setFromChain] = useState<ChainOption | null>({
        id: 56,
        name: 'BNB Chain',
        icon: require('@/assets/home/chains/ethereum.svg'), // Temporary, synced in useEffect
    });
    const [toChain, setToChain] = useState<ChainOption | null>({
        id: 56,
        name: 'BNB Chain',
        icon: require('@/assets/home/chains/ethereum.svg'),
    });
    const [fromToken, setFromToken] = useState<TokenOption | null>({
        id: '0x0000000000000000000000000000000000000000',
        symbol: 'BNB',
        name: 'BNB',
        icon: undefined,
        tvl: '$0',
        balanceFiat: '$0',
        balanceToken: '0.00 BNB',
        address: '0x0000000000000000000000000000000000000000',
        chainId: 56,
        decimals: 18
    });
    const [toToken, setToToken] = useState<TokenOption | null>({
        id: '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596',
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
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [fromFiatAmount, setFromFiatAmount] = useState('$0.00');
    const [toFiatAmount, setToFiatAmount] = useState('$0.00');

    const { currency, region } = useLocaleStore();

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
    const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);

    const { address } = useWalletStore();
    const { isTransactionRiskEnabled } = useSecurityStore();

    // Pre-populate from params if coming from asset detail
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

    const handleLimitAssetSelect = (target: 'from' | 'to') => {
        setWhenPriceTarget(target);
        setIsLimitAssetSheetVisible(false);
    };


    const handleSwapDirection = () => {
        const tempChain = fromChain;
        setFromChain(toChain);
        setToChain(tempChain);

        const tempToken = fromToken;
        setFromToken(toToken);
        setToToken(tempToken);

        setFromAmount('');
        setToAmount('');
        setFromFiatAmount('$0.00');
        setToFiatAmount('$0.00');
        setSwapQuote(null);
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
            const fetchedQuote = await fetchSwapQuote(fromAmount, fromToken, toToken, address || '', address || '');

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
            const { apiClient } = require('@/services/apiClient');
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

    const isFormValid = () => {
        if (activeTab === 'swap') {
            return !!fromAmount && !!fromToken && !!toToken;
        } else {
            return !!fromAmount && !!fromToken && !!toToken && !!whenPrice;
        }
    };

    console.log("🚀 ~ SwapScreen ~:", { fromChain, toChain })
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
                    <SwapHeader onWalletPress={() => setIsWalletModalVisible(true)} />

                    <View style={styles.contentPadding}>
                        <SwapTabs activeTab={activeTab} onChange={setActiveTab} />

                        <View style={styles.spacerLarge} />

                        <ChainSelectorCard
                            chainName={fromChain?.name || 'Select Chain'}
                            chainIcon={fromChain?.icon || require('@/assets/home/chains/ethereum.svg')}
                            onPress={() => handleOpenAssetSheet('from', 'chains')}
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
                                    balanceText={toToken ? '0.00' : '0.00'}
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
                            slippageTolerance={`${swapQuote?.slippage || 0}%`}
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
