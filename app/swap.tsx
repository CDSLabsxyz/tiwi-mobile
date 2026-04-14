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
    UnifiedAssetSelectSheet,
    SwapKeyboard
} from '@/components/sections/Swap';
import { Ionicons } from '@expo/vector-icons';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { WalletModal } from '@/components/ui/wallet-modal';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { useTokenPrefetch } from '@/hooks/useTokenPrefetch';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { activityService } from '@/services/activityService';
import { api } from '@/lib/mobile/api-client';
import { signerController } from '@/services/signer/SignerController';
import { getChainById } from '@/services/signer/SignerUtils';
import { securityGuard } from '@/services/securityGuard';
import { executeSwap, fetchSwapQuote } from '@/services/swap';
import { isNativeToken } from '@/services/swap/constants';
import { useLocaleStore } from '@/store/localeStore';
import { useSecurityStore } from '@/store/securityStore';
import { useSwapStore } from '@/store/swapStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCompactNumber, formatFiatValue, formatTokenAmount } from '@/utils/formatting';
import { useRequireBackup } from '@/hooks/useRequireBackup';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SwapScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();

    // Backup gate — checked at action-time (swap button press), not on page mount.
    const { requireBackup, BackupRequiredModal } = useRequireBackup();
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
    const queryClient = useQueryClient();

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
    const [customExpiryValue, setCustomExpiryValue] = useState('');
    const [customExpiryUnit, setCustomExpiryUnit] = useState<'hours' | 'days' | 'months'>('days');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [isLoadingSwap, setIsLoadingSwap] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
    const [isComingSoonVisible, setIsComingSoonVisible] = useState(false);
    const [swapErrorMessage, setSwapErrorMessage] = useState<string | null>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [taxPaid, setTaxPaid] = useState(false);
    const [isPayingTax, setIsPayingTax] = useState(false);

    const scrollViewRef = React.useRef<ScrollView>(null);

    useEffect(() => {
        if (isKeyboardVisible) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 150, animated: true });
            }, 50);
        }
    }, [isKeyboardVisible]);

    const { address, walletGroups, activeGroupId } = useWalletStore();

    // Map chainId to wallet chain type
    const getChainTypeFromId = (chainId: any): string => {
        if (typeof chainId !== 'number') return 'EVM';
        if (chainId === 7565164 || chainId === 1399811149) return 'SOLANA';
        if (chainId === 728126428) return 'TRON';
        if (chainId === 1100 || chainId === 99999) return 'TON';
        if (chainId === 118 || chainId === 99998) return 'COSMOS';
        return 'EVM';
    };

    // Get wallet address for a specific chain
    const getAddressForChain = useCallback((chainId: any) => {
        const group = walletGroups.find(g => g.id === activeGroupId);
        if (!group) return address || '';
        const chainType = getChainTypeFromId(chainId);
        return (group.addresses as any)?.[chainType] || address || '';
    }, [walletGroups, activeGroupId, address]);

    // Determine if this is a bridge (cross-chain) or same-chain swap
    const isBridge = useMemo(() => {
        if (!fromChain || !toChain) return false;
        return fromChain.id !== toChain.id;
    }, [fromChain, toChain]);
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
        // Skip default price updates if we're pre-populating from params
        if (hasParams && !paramsAppliedRef.current) return;

        const updatePrices = async () => {
            try {
                // Silently update chain icons if missing
                if (chains && fromChain && !fromChain.icon) {
                    const real = chains.find(c => c.id === fromChain.id);
                    if (real) setFromChain({ ...fromChain, icon: real.logoURI });
                }
                if (chains && toChain && !toChain.icon) {
                    const real = chains.find(c => c.id === toChain.id);
                    if (real) setToChain({ ...toChain, icon: real.logoURI });
                }

                // Silently update token info if it's our defaults
                const isDefaultBnb = fromToken?.address === "0x0000000000000000000000000000000000000000";
                const isDefaultTwc = toToken?.address === "0xDA1060158F7D593667CCE0A15DB346BB3FfB3596";

                if (isDefaultBnb || isDefaultTwc) {
                    const [bnbRes, twcRes] = await Promise.all([
                        api.tokens.list({ address: '0x0000000000000000000000000000000000000000', chains: [56], limit: 1 }),
                        api.tokens.list({ address: '0xDA1060158F7D593667CCE0A15DB346BB3FFB3596', chains: [56], limit: 1 })
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
    const hasParams = !!(params.symbol && params.chainId);
    const paramsAppliedRef = React.useRef(false);

    useEffect(() => {
        if (hasParams && chains && !paramsAppliedRef.current) {
            const chain = chains.find(c => String(c.id) === params.chainId);

            if (chain) {
                paramsAppliedRef.current = true;
                const chainOption = {
                    id: chain.id,
                    name: chain.name,
                    icon: chain.logoURI
                };
                setFromChain(chainOption);
                setFromToken({
                    id: params.assetId || params.symbol,
                    symbol: params.symbol!,
                    name: params.name || params.symbol!,
                    icon: params.logo,
                    balanceToken: params.balance || '0.00',
                    balanceFiat: params.usdValue || '$0.00',
                    priceUSD: params.priceUSD || '0',
                    address: params.assetId || '',
                    chainId: chainOption.id,
                    decimals: 18
                } as any);
                setToChain(null);
                setToToken(null);
            }
        }
    }, [hasParams, chains]);

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
        setTaxPaid(false); // Reset tax on token change
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

    const handleKeyboardPress = (key: string) => {
        if (key === 'DELETE') {
            setFromAmount(fromAmount.slice(0, -1));
            return;
        }

        if (key === '.' && fromAmount.includes('.')) return;

        if (key === '.' && (!fromAmount || fromAmount === '')) {
            setFromAmount('0.');
            return;
        }

        if (fromAmount.includes('.')) {
            const [, dec] = fromAmount.split('.');
            if (dec && dec.length >= 6) return;
        }

        setFromAmount(fromAmount + key);
    };

    const parseBalanceToken = (balanceStr: string): number => {
        const parts = balanceStr.trim().split(/\s+/);
        let num = parseFloat(parts[0] || '0');
        const suffix = (parts[1] || '').toUpperCase();
        if (suffix === 'B') num *= 1e9;
        else if (suffix === 'M') num *= 1e6;
        else if (suffix === 'K') num *= 1e3;
        return num;
    };

    const handlePercentagePress = (percentage: number) => {
        if (!fromToken?.balanceToken) return;
        const maxBal = parseBalanceToken(fromToken.balanceToken);
        if (maxBal <= 0) return;
        let val = maxBal * percentage / 100;

        // When using max on EVM swaps, reserve 0.25% for the service fee
        if (percentage === 100 && !taxPaid) {
            const chainId = Number(fromChain?.id) || 56;
            const isEvm = ![7565164, 1399811149, 728126428, 1100, 99999, 118, 99998].includes(chainId);
            if (isEvm) {
                val = val * 0.99;
            }
        }

        setFromAmount(val.toFixed(6).replace(/\.?0+$/, ''));
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
            setTaxPaid(false); // Reset tax on amount change
            return;
        }

        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoadingQuote(true);
            setIsStale(false); // Reset stale on manual change
        }
        try {
            const fromAddr = getAddressForChain(fromToken.chainId);
            const toAddr = getAddressForChain(toToken.chainId);
            // TWC has a 5% transfer tax — enforce minimum slippage to prevent "Return amount is not enough" reverts
            const isTwcSwap = fromToken.address.toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596' ||
                              toToken.address.toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
            const effectiveSlippage = isTwcSwap ? Math.max(slippage, 10) : slippage;
            const fetchedQuote = await fetchSwapQuote(fromAmount, fromToken, toToken, fromAddr, toAddr, effectiveSlippage);

            if (fetchedQuote) {
                // Override output for TWC swaps — backend quotes are unreliable for fee-on-transfer tokens
                const isTwcFrom = fromToken.address.toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
                const isTwcTo = toToken.address.toLowerCase() === '0xda1060158f7d593667cce0a15db346bb3ffb3596';
                if ((isTwcFrom || isTwcTo) && fromToken.priceUSD && toToken.priceUSD && parseFloat(toToken.priceUSD) > 0 && parseFloat(fromToken.priceUSD) > 0) {
                    const fromUsd = parseFloat(fromAmount) * parseFloat(fromToken.priceUSD);
                    const correctedToAmount = (fromUsd / parseFloat(toToken.priceUSD)).toFixed(8).replace(/\.?0+$/, '');
                    fetchedQuote.toAmount = correctedToAmount;
                }

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

    const isInsufficientBalanceError = (error: any): boolean => {
        const msg = (error?.message || error?.reason || '').toLowerCase();
        return (
            msg.includes('insufficient') ||
            msg.includes('exceeds balance') ||
            msg.includes('not enough') ||
            msg.includes('underflow') ||
            msg.includes('transfer amount exceeds') ||
            msg.includes('exceeds allowance') ||
            msg.includes('insufficient funds for gas') ||
            msg.includes('gas required exceeds') ||
            msg.includes('out of gas')
        );
    };

    const cleanErrorMessage = (error: any): string => {
        const msg = error?.message || 'Swap failed. Please try again.';
        // Extract just the reason from viem's verbose errors
        const reasonMatch = msg.match(/reverted with reason:\s*([^\n.]+)/i);
        if (reasonMatch) return `Transaction failed: ${reasonMatch[1].trim()}`;
        const detailsMatch = msg.match(/Details:\s*([^\n]+)/i);
        if (detailsMatch) return detailsMatch[1].trim();
        // Truncate overly long messages (viem dumps full tx data)
        if (msg.length > 150) return msg.slice(0, 150) + '...';
        return msg;
    };

    const isGasError = (error: any): boolean => {
        const msg = (error?.message || '').toLowerCase();
        return (
            msg.includes('insufficient funds for transfer') ||
            msg.includes('insufficient funds for gas') ||
            msg.includes('total cost') ||
            msg.includes('gas * gas fee + value')
        );
    };

    const handleConfirmSwap = async () => {
        if (!requireBackup()) return;
        if (!fromAmount || !fromToken || !toToken || !address) return;

        const maxBal = parseBalanceToken(fromToken.balanceToken || '0');
        const swapAmount = parseFloat(fromAmount);

        // Pre-check: Minimum swap amount ($0.10)
        const fromUsdValue = fromToken.priceUSD ? swapAmount * parseFloat(fromToken.priceUSD) : 0;
        if (fromUsdValue > 0 && fromUsdValue < 0.1) {
            setSwapErrorMessage('Swap amount is too small. Please enter a higher amount.');
            return;
        }

        // Pre-check: Insufficient balance
        if (swapAmount > maxBal) {
            setSwapErrorMessage(`Not enough ${fromToken.symbol} to complete this swap. Please try with a lower amount.`);
            return;
        }

        // Pre-check: After 0.25% tax, will there be enough left to swap?
        const fromChainId = Number(fromChain?.id) || 56;
        const isEvmSwap = ![7565164, 1399811149, 728126428, 1100, 99999, 118, 99998].includes(fromChainId);
        if (isEvmSwap && !taxPaid) {
            const taxAmount = swapAmount * 0.0025;
            const remainingAfterTax = maxBal - taxAmount;
            if (swapAmount > remainingAfterTax) {
                setSwapErrorMessage(`Not enough ${fromToken.symbol} to complete this swap. Please try with a lower amount.`);
                return;
            }
        }

        setIsLoadingSwap(true);

        try {
            // PRE-FLIGHT: Simulate swap transaction before collecting tax
            // This prevents tax loss when the swap would fail (e.g. amount too small, reverts)
            if (!taxPaid && isEvmSwap && swapQuote) {
                const txReq = swapQuote.transactionRequest;
                if (txReq?.to && txReq?.data && txReq.data !== '0x') {
                    try {
                        console.log('[Swap] Pre-flight: simulating swap transaction...');
                        const publicClient = await signerController.getPublicClient(fromChainId);
                        const evmAddr = getAddressForChain(fromChainId);
                        await publicClient.estimateGas({
                            account: evmAddr as `0x${string}`,
                            to: txReq.to as `0x${string}`,
                            data: txReq.data as `0x${string}`,
                            value: txReq.value ? BigInt(txReq.value) : 0n,
                        });
                        console.log('[Swap] Pre-flight: simulation passed');
                    } catch (simError: any) {
                        const msg = simError.message || '';
                        // Log as warn (not error) — this is expected when swap would revert.
                        // console.error triggers the React Native LogBox red screen.
                        console.warn('[Swap] Pre-flight simulation failed (expected for unsupported tokens):', msg.slice(0, 200));
                        const isFeeOnTransferError =
                            msg.includes('TRANSFER_FROM_FAILED') ||
                            msg.includes('TransferHelper: TRANSFER_FROM_FAILED') ||
                            msg.includes('SafeERC20: low-level call failed') ||
                            msg.includes('SafeERC20');

                        if (msg.includes('TOO_SMALL')) {
                            setSwapErrorMessage('Swap amount is too small for this route. Please increase the amount.');
                        } else if (isFeeOnTransferError) {
                            setSwapErrorMessage(
                                `${fromToken.symbol} has a transfer tax that isn't supported by the available routes. ` +
                                `This token can't be swapped on-chain through our current DEX integration. ` +
                                `Try sending ${fromToken.symbol} directly to an exchange to swap it there.`
                            );
                        } else if (msg.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
                            setSwapErrorMessage('Price moved — increase slippage or try a smaller amount.');
                        } else if (msg.includes('insufficient funds')) {
                            const chain = getChainById(fromChainId);
                            const gasToken = chain.nativeCurrency?.symbol || 'ETH';
                            setSwapErrorMessage(`Not enough ${gasToken} on ${chain.name} to pay for gas fees.`);
                        } else {
                            setSwapErrorMessage(`Swap would fail: ${msg.slice(0, 150)}`);
                        }
                        setIsLoadingSwap(false);
                        return;
                    }
                }
            }

            // STEP 1: Pay 0.25% Initialization Fee (EVM only)
            if (!taxPaid && isEvmSwap) {
                console.log("[Swap] Executing Step 1 (Initialization)...");

                const taxAmount = (parseFloat(fromAmount) * 0.0025).toFixed(fromToken.decimals || 18);
                const revenueWallet = "0x2452fC6B401FaB80D9fDa6050b2De0Dd42b233bc";
                const chainId = Number(fromChain?.id) || 56;
                const evmAddr = getAddressForChain(chainId);

                const isNative = isNativeToken(fromToken.address);

                let step1Hash = '';

                if (isNative) {
                    const { parseUnits } = require('viem');
                    const valueAtomic = parseUnits(taxAmount, 18);

                    const res = await signerController.executeTransaction({
                        chainFamily: 'evm',
                        to: revenueWallet,
                        value: valueAtomic.toString(),
                        data: '0x',
                        chainId: chainId,
                    }, evmAddr, { skipAuthorize: true });
                    if (res.status === 'failed') throw new Error(res.error || 'Initialization failed (Step 1)');
                    step1Hash = res.hash;
                } else {
                    const { encodeFunctionData, parseUnits } = require('viem');
                    const amountAtomic = parseUnits(taxAmount, fromToken.decimals || 18);

                    const res = await signerController.executeTransaction({
                        chainFamily: 'evm',
                        to: fromToken.address,
                        data: encodeFunctionData({
                            abi: [{
                                inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256'}],
                                name: 'transfer',
                                type: 'function'
                            }],
                            functionName: 'transfer',
                            args: [revenueWallet, amountAtomic]
                        }),
                        chainId: chainId,
                    }, evmAddr, { skipAuthorize: true });
                    if (res.status === 'failed') throw new Error(res.error || 'Initialization failed (Step 1)');
                    step1Hash = res.hash;
                }

                // Wait for Step 1 confirmation before Step 2 to avoid nonce conflicts
                if (step1Hash) {
                    try {
                        const publicClient = await signerController.getPublicClient(chainId);
                        await publicClient.waitForTransactionReceipt({ hash: step1Hash as `0x${string}`, timeout: 60000 });
                        console.log("[Swap] Step 1 confirmed on-chain:", step1Hash);
                    } catch (waitErr: any) {
                        console.warn("[Swap] Step 1 confirmation wait failed, proceeding:", waitErr.message);
                        // Brief fallback wait to allow nonce propagation
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }

                setTaxPaid(true); // Persist if the final swap fails so we don't double charge on retry
            }

            // Calculate the actual swap amount after tax deduction
            // Only deduct if tax was paid in this session (EVM swaps deduct 0.25% from the same token)
            const taxRate = 0.0025;
            const wasTaxJustPaid = isEvmSwap; // tax is always charged for EVM swaps
            const actualSwapAmount = wasTaxJustPaid
                ? (parseFloat(fromAmount) * (1 - taxRate)).toString()
                : fromAmount;

            // STEP 2: Execute Swap (Chain directly after Step 1)
            console.log("[Swap] Executing Step 2 (Finalization)...");

            // Security Check: Token Risk
            if (isTransactionRiskEnabled && !taxPaid) { // Only check once if possible
                try {
                    const toTokenRisk = await securityGuard.checkTokenRisk(toToken.address, Number(fromChain?.id) || 1);
                    if (!toTokenRisk.isSafe) {
                        setIsLoadingSwap(false); // Pause loading for alert
                        Alert.alert(
                            'Security Warning',
                            `Tiwi Protocol detected risks with ${toToken.symbol}:\n\n${toTokenRisk.warnings.join('\n')}\n\nDo you want to proceed anyway?`,
                            [
                                { text: 'Cancel', style: 'cancel', onPress: () => setIsLoadingSwap(false) },
                                {
                                    text: 'Proceed',
                                    style: 'destructive',
                                    onPress: () => performExecution(actualSwapAmount)
                                }
                            ]
                        );
                        return;
                    }
                } catch (e) {
                    console.error('Security check failed:', e);
                }
            }

            await performExecution(actualSwapAmount);

        } catch (error: any) {
            console.error("Swap sequence failed:", error.message, error);
            setIsLoadingSwap(false);
            if (isGasError(error)) {
                const chain = getChainById(Number(fromChain?.id) || 1);
                const gasToken = chain.nativeCurrency?.symbol || 'ETH';
                setSwapErrorMessage(`Not enough ${gasToken} on ${chain.name} to pay for gas fees. Please add ${gasToken} to cover transaction costs.`);
            } else if (isInsufficientBalanceError(error)) {
                setSwapErrorMessage(`Not enough ${fromToken.symbol} to complete this swap. Please try with a lower amount.`);
            } else {
                setSwapErrorMessage(cleanErrorMessage(error));
            }
        }
    };

    const performExecution = async (adjustedAmount?: string) => {
        const swapFromAmount = adjustedAmount || fromAmount;
        if (!swapFromAmount || !fromToken || !toToken || !address) return;
        setIsLoadingSwap(true);
        try {
            if (!swapQuote) throw new Error('No swap quote available');

            // PRE-APPROVE: For Relay swaps with ERC20 tokens, approve before executing (EVM only)
            const execChainId = Number(fromChain?.id) || 56;
            const isEvmExec = ![7565164, 1399811149, 728126428, 1100, 99999, 118, 99998].includes(execChainId);

            if (swapQuote.router === 'relay' && !isNativeToken(fromToken.address) && isEvmExec) {
                console.log('[Swap] Pre-approving token for Relay swap...');
                const { encodeFunctionData, getAddress, parseUnits: viemParseUnits } = require('viem');
                const chainId = Number(fromChain?.id) || 56;
                const amountIn = viemParseUnits(swapFromAmount, fromToken.decimals || 18);
                const publicClient = await signerController.getPublicClient(chainId);
                const tokenAddr = getAddress(fromToken.address).toLowerCase();

                // Collect spender addresses from multiple sources
                const spenderAddresses = new Set<string>();

                const steps = swapQuote.raw?.steps || [];

                // Log full step structure for debugging
                console.log(`[Swap] Quote has ${steps.length} steps`);
                for (const step of steps) {
                    for (const item of (step as any).items || []) {
                        const to = item.data?.to || '';
                        const data = String(item.data?.data || '');
                        console.log(`[Swap]   Item: to=${to}, data=${data.slice(0, 20)}..., approvalAddress=${item.data?.approvalAddress || 'none'}`);

                        // Source 1: Explicit approvalAddress from Relay quote
                        if (item.data?.approvalAddress) {
                            spenderAddresses.add(item.data.approvalAddress.toLowerCase());
                        }

                        // Source 2: Decode spender from approve() calldata
                        // If this item is an approve() call (selector 0x095ea7b3), the spender is in the calldata
                        if (data.toLowerCase().startsWith('0x095ea7b3') && data.length >= 74) {
                            const spenderHex = '0x' + data.slice(34, 74);
                            console.log(`[Swap]   Decoded spender from approve calldata: ${spenderHex}`);
                            spenderAddresses.add(spenderHex.toLowerCase());
                        }

                        // Source 3: Non-token 'to' addresses (the actual Relay contract)
                        if (to && getAddress(to).toLowerCase() !== tokenAddr) {
                            spenderAddresses.add(to.toLowerCase());
                        }
                    }
                }

                // Source 4: Fetch official ApprovalProxy from Relay API
                try {
                    const chainsRes = await fetch('https://api.relay.link/chains');
                    if (chainsRes.ok) {
                        const chainsData = await chainsRes.json();
                        const chain = (chainsData.chains || []).find((c: any) => c.id === chainId);
                        const proxy = chain?.contracts?.v3ApprovalProxy || chain?.contracts?.approvalProxy;
                        if (proxy) {
                            spenderAddresses.add(proxy.toLowerCase());
                            console.log(`[Swap] Relay API ApprovalProxy: ${proxy}`);
                        }
                    }
                } catch (e) {
                    console.warn('[Swap] Failed to fetch Relay chains:', e);
                }

                console.log(`[Swap] Final spender set: ${[...spenderAddresses].join(', ')}`);

                const ERC20_ABI = [
                    { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
                    { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
                ] as const;

                // Approve each spender with max uint256
                for (const spender of spenderAddresses) {
                    try {
                        const allowance = await publicClient.readContract({
                            address: getAddress(fromToken.address),
                            abi: ERC20_ABI,
                            functionName: 'allowance',
                            args: [getAddress(address), getAddress(spender)],
                        }) as bigint;

                        console.log(`[Swap] Allowance for ${spender}: ${allowance.toString()}`);

                        if (allowance < amountIn) {
                            console.log(`[Swap] Approving ${fromToken.symbol} for ${spender}...`);
                            const approveData = encodeFunctionData({
                                abi: ERC20_ABI,
                                functionName: 'approve',
                                args: [getAddress(spender), BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
                            });

                            const approveResult = await signerController.executeTransaction({
                                chainFamily: 'evm',
                                to: fromToken.address,
                                data: approveData,
                                chainId: chainId,
                            }, address, { skipAuthorize: true });

                            if (approveResult.status === 'failed') {
                                throw new Error('Token approval failed: ' + (approveResult.error || 'Unknown error'));
                            }

                            // Wait for on-chain confirmation
                            if (approveResult.hash) {
                                try {
                                    await publicClient.waitForTransactionReceipt({ hash: approveResult.hash as `0x${string}`, timeout: 30000 });
                                } catch {
                                    await new Promise(r => setTimeout(r, 5000));
                                }
                            } else {
                                await new Promise(r => setTimeout(r, 5000));
                            }
                            console.log(`[Swap] Approval confirmed for ${spender}`);
                        } else {
                            console.log(`[Swap] Already approved for ${spender}`);
                        }
                    } catch (err: any) {
                        console.error(`[Swap] Approval error for ${spender}:`, err.message);
                        throw new Error(`Token approval failed: ${err.message}`);
                    }
                }

                console.log('[Swap] All approvals done, proceeding to swap...');
            }

            const fromAddr = getAddressForChain(fromToken.chainId);
            const toAddr = getAddressForChain(toToken.chainId);
            const result = await executeSwap(swapFromAmount, fromToken, toToken, fromAddr, toAddr, swapQuote);

            const txHash = result?.txHash;
            if (!txHash) {
                throw new Error('Swap did not return a transaction hash.');
            }
            const chainId = Number(fromChain?.id) || 56;

            // Verify the swap tx was confirmed on-chain (not just broadcast)
            try {
                const publicClient = await signerController.getPublicClient(chainId);
                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 60000 });
                if (receipt.status === 'reverted') {
                    throw new Error('Swap transaction reverted on-chain. Your tokens were not swapped.');
                }
                console.log('[Swap] Step 2 confirmed on-chain:', txHash);
            } catch (verifyErr: any) {
                if (verifyErr.message?.includes('reverted')) {
                    throw verifyErr;
                }
                console.warn('[Swap] Could not verify tx receipt, proceeding:', verifyErr.message);
            }

            // 1. Log detailed transaction to backend for indexing
            try {
                await api.wallet.logTransaction({
                    walletAddress: address,
                    transactionHash: txHash,
                    chainId: chainId,
                    type: activeTab === 'limit' ? 'ContractCall' : 'Swap',
                    fromTokenAddress: fromToken.address,
                    fromTokenSymbol: fromToken.symbol,
                    toTokenAddress: toToken.address,
                    toTokenSymbol: toToken.symbol,
                    amount: swapFromAmount,
                    amountFormatted: `${swapFromAmount} ${fromToken.symbol}`,
                    usdValue: parseFloat(fromFiatAmount.replace(/[^0-9.]/g, '') || '0'),
                    routerName: swapQuote?.router || 'relay'
                });
            } catch (err) {
                console.warn('[Swap] Backend logging failed:', err);
            }

            // 2. Log activity + trigger push notification
            await activityService.logTransaction(
                address,
                'swap',
                activeTab === 'limit' ? 'Limit Order Placed' : 'Swap Successful',
                `You swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`,
                txHash,
                {
                    fromToken: fromToken.symbol,
                    toToken: toToken.symbol,
                    fromAmount,
                    toAmount,
                    chainId,
                    symbol: toToken.symbol,
                    amount: toAmount,
                    router: swapQuote?.router
                }
            );

            setIsLoadingSwap(false);
            setIsSuccessModalVisible(true);

            // Immediately refresh wallet balances so new amounts show up
            queryClient.invalidateQueries({ queryKey: ['walletBalances'] });

        } catch (error: any) {
            console.error('Swap execution failed:', error.message, error);
            setIsLoadingSwap(false);
            if (isGasError(error)) {
                const chain = getChainById(Number(fromChain?.id) || 1);
                const gasToken = chain.nativeCurrency?.symbol || 'ETH';
                setSwapErrorMessage(`Not enough ${gasToken} on ${chain.name} to pay for gas fees. Please add ${gasToken} to cover transaction costs.`);
            } else if (isInsufficientBalanceError(error)) {
                setSwapErrorMessage(`Not enough ${fromToken.symbol} to complete this swap. Please try with a lower amount.`);
            } else {
                setSwapErrorMessage(cleanErrorMessage(error));
            }
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
                    onHistoryPress={() => { setGlobalWalletModalVisible(false); router.push('/activities' as any); }}
                    onSettingsPress={() => { setGlobalWalletModalVisible(false); router.push('/settings' as any); }}
                    onDisconnectPress={() => { setGlobalWalletModalVisible(false); }}
                />

                <SwapSettingsSheet
                    visible={isSettingsSheetVisible}
                    onClose={() => setIsSettingsSheetVisible(false)}
                />

                <ChainSelectSheet
                    visible={isChainSheetVisible}
                    selectedChainId={chainSheetTarget === 'from' ? (fromChain?.id || null) : (toChain?.id || null)}
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

                {/* Coming Soon Modal */}
                <Modal
                    visible={isComingSoonVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsComingSoonVisible(false)}
                >
                    <View style={styles.comingSoonOverlay}>
                        <View style={styles.comingSoonModal}>
                            <Ionicons name="construct-outline" size={48} color={colors.primaryCTA} />
                            <Text style={styles.comingSoonTitle}>Feature In Progress</Text>
                            <Text style={styles.comingSoonText}>
                                This swap route is currently being optimized. Our team is actively working to support this pair. Please try a different token or check back soon.
                            </Text>
                            <TouchableOpacity
                                style={styles.comingSoonButton}
                                onPress={() => setIsComingSoonVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.comingSoonButtonText}>Got it</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Insufficient Balance Modal */}
                <Modal
                    visible={!!swapErrorMessage}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setSwapErrorMessage(null)}
                >
                    <TouchableOpacity
                        style={styles.comingSoonOverlay}
                        activeOpacity={1}
                        onPress={() => setSwapErrorMessage(null)}
                    >
                        <View style={styles.comingSoonModal}>
                            <Ionicons name="wallet-outline" size={48} color="#FF6B6B" />
                            <Text style={styles.comingSoonTitle}>Swap Failed</Text>
                            <Text style={styles.comingSoonText} numberOfLines={4}>
                                {swapErrorMessage}
                            </Text>
                            <TouchableOpacity
                                style={[styles.comingSoonButton, { backgroundColor: '#FF6B6B' }]}
                                onPress={() => setSwapErrorMessage(null)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.comingSoonButtonText}>Got it</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                <ScrollView
                    ref={scrollViewRef}
                    style={styles.flex1}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: isKeyboardVisible ? 400 : ((bottom || 16) + 32) }
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
                                onTokenPress={() => handleOpenAssetSheet('from', 'chains')}
                                onMaxPress={() => handlePercentagePress(100)}
                                onInputPress={() => setIsKeyboardVisible(true)}
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
                                    onTokenPress={() => handleOpenAssetSheet('to', 'chains')}
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
                                    customValue={customExpiryValue}
                                    customUnit={customExpiryUnit}
                                    onCustomChange={(val, unit) => {
                                        setCustomExpiryValue(val);
                                        setCustomExpiryUnit(unit);
                                    }}
                                />
                            </View>
                        )}

                        <View style={styles.spacerLarge} />

                        <SwapConfirmButton
                            disabled={!isFormValid() || !swapQuote || isLoadingSwap || isRefreshing || isLoadingQuote || isPayingTax}
                            loading={isLoadingSwap || isPayingTax}
                            onPress={handleConfirmSwap}
                            isRefreshing={isRefreshing}
                            isStale={isStale}
                            activeTab={activeTab}
                            hasValidQuote={hasValidQuote()}
                            title={!taxPaid ? (isBridge ? 'Bridge' : 'Swap') : 'Finalize Swap'}
                        />
                    </View>
                </ScrollView>

                <SwapKeyboard
                    visible={isKeyboardVisible}
                    onClose={() => setIsKeyboardVisible(false)}
                    onKeyPress={handleKeyboardPress}
                    onPercentagePress={handlePercentagePress}
                    onMaxPress={() => handlePercentagePress(100)}
                />
            </View>
            {BackupRequiredModal}
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
    comingSoonOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    comingSoonModal: {
        width: '100%',
        backgroundColor: '#111810',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1F261E',
        padding: 32,
        alignItems: 'center',
        gap: 12,
    },
    comingSoonTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: '#FFFFFF',
    },
    comingSoonText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        lineHeight: 20,
    },
    comingSoonButton: {
        width: '100%',
        height: 48,
        backgroundColor: colors.primaryCTA,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    comingSoonButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: '#010501',
    },
});
