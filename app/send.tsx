import { Image } from 'expo-image';
/**
 * Send Screen
 * Main send page with two tabs: Send to One and Multi-Send
 * Matches Figma designs (node-id: 3279-118948, 3279-119800, etc.)
 */

import { MultiSendForm } from '@/components/sections/Send/MultiSendForm';
import { MultiSendReview } from '@/components/sections/Send/MultiSendReview';
import { PasscodeScreen } from '@/components/sections/Send/PasscodeScreen';
import { SendForm } from '@/components/sections/Send/SendForm';
import { SendReview } from '@/components/sections/Send/SendReview';
import { SendTokenSelector } from '@/components/sections/Send/SendTokenSelector';
import { SendTokenSelectSheet } from '@/components/sections/Send/SendTokenSelectSheet';
import { WalletHeader } from '@/components/sections/Wallet/WalletHeader';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { activityService } from '@/services/activityService';
import { apiClient } from '@/services/apiClient';
import { fetchWalletData } from '@/services/walletService';
import { useSendStore } from '@/store/sendStore';
import { useWalletStore } from '@/store/walletStore';
import { validateAddress, validateAddresses, validateAmount } from '@/utils/addressValidation';
import { mapAssetToTokenOption } from '@/utils/assetMapping';
import { WALLET_ADDRESS } from '@/utils/wallet';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SendScreen() {
    const { top, bottom } = useSafeAreaInsets();
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

    const sendStore = useSendStore();
    const {
        activeTab,
        selectedToken,
        currentStep,
        isTokenSheetVisible,
        setActiveTab,
        setCurrentStep,
        openTokenSheet,
        closeTokenSheet,
        resetSendState,
        prePopulateFromAsset,
    } = sendStore;

    const { data: chains } = useChains();

    // Check if we're coming from asset detail page
    useEffect(() => {
        if (!chains) return;

        if (params.symbol && params.chainId) {
            // Instant pre-population from params
            const tokenOption = {
                id: params.assetId || params.symbol,
                symbol: params.symbol,
                name: params.name || params.symbol,
                icon: params.logo,
                balanceToken: params.balance || '0',
                balanceFiat: params.usdValue || '$0',
                priceUSD: params.priceUSD || '0',
            };

            const chain = chains.find(c => String(c.id) === params.chainId);
            if (tokenOption && chain) {
                const chainOption = {
                    id: chain.id,
                    name: chain.name,
                    icon: chain.logoURI || chain.logo
                };
                prePopulateFromAsset(tokenOption as any, chainOption, params.balance || '0', params.usdValue || '$0');
                return;
            }
        }

        if (params.assetId) {
            // Fallback: fetch from wallet data if we only have ID
            const loadAsset = async () => {
                try {
                    const walletData = await fetchWalletData(WALLET_ADDRESS);
                    const asset = walletData.portfolio.find((a) => a.id === params.assetId);
                    if (asset) {
                        const tokenOption = mapAssetToTokenOption(asset, asset.balance, asset.usdValue);
                        const chain = chains.find(c => c.id === asset.chainId);

                        if (tokenOption && chain) {
                            const chainOption = {
                                id: chain.id,
                                name: chain.name,
                                icon: chain.logoURI || chain.logo
                            };
                            prePopulateFromAsset(tokenOption, chainOption, asset.balance, asset.usdValue);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load asset:', error);
                }
            };
            loadAsset();
        } else {
            // Reset to initial state
            resetSendState();
        }
    }, [params.assetId, params.symbol, params.chainId, chains]);

    const { address } = useWalletStore();

    // Handlers
    const handleBackPress = () => {
        if (currentStep === 'select-asset') {
            router.back();
        } else if (currentStep === 'enter-details') {
            setCurrentStep('select-asset');
        } else if (currentStep === 'review') {
            setCurrentStep('enter-details');
        } else if (currentStep === 'passcode') {
            setCurrentStep('review');
        }
    };

    const handleIrisScanPress = () => {
        console.log('Iris scan pressed');
    };

    const handleSettingsPress = () => {
        const currentRoute = pathname || '/send';
        router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
    };

    const handleTokenSelect = async (token: any, chainId?: string) => {
        sendStore.setSelectedToken(token);
        // Set chain if provided
        if (chainId && chains) {
            const chain = chains.find(c => String(c.id) === chainId);
            if (chain) {
                sendStore.setSelectedChain({
                    id: chain.id,
                    name: chain.name,
                    icon: chain.logoURI || chain.logo
                });
            }
        } else if (address && chains) {
            // Fallback: Get chain info from wallet data
            try {
                const res = await apiClient.getWalletBalances(address || WALLET_ADDRESS);
                const asset = res.balances.find((a: any) => a.symbol === token.symbol);
                if (asset) {
                    const chain = chains.find(c => c.id === asset.chainId);
                    if (chain) {
                        sendStore.setSelectedChain({
                            id: chain.id,
                            name: chain.name,
                            icon: chain.logoURI || chain.logo
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to load chain info:', error);
            }
        }
        closeTokenSheet();
    };

    const handleNextFromSelect = () => {
        if (selectedToken) {
            setCurrentStep('enter-details');
        } else {
            openTokenSheet();
        }
    };

    const handleNextFromForm = () => {
        setCurrentStep('review');
    };

    const handleConfirmFromReview = () => {
        setCurrentStep('passcode');
    };

    const handlePasscodeSuccess = async () => {
        console.log('Transaction confirmed!');

        if (address) {
            try {
                // Log the send transaction(s)
                if (activeTab === 'send-to-one') {
                    const txHash = `send-hash-${Date.now()}`;
                    await apiClient.logTransaction({
                        walletAddress: address,
                        transactionHash: txHash,
                        chainId: parseInt(String(sendStore.selectedChain?.id || '1')),
                        type: 'Sent',
                        fromTokenAddress: sendStore.selectedToken?.id,
                        fromTokenSymbol: sendStore.selectedToken?.symbol,
                        amount: sendStore.amount,
                        amountFormatted: `${sendStore.amount} ${sendStore.selectedToken?.symbol}`,
                        toTokenAddress: sendStore.recipientAddress, // Recipient as target address
                    });

                    // Log activity
                    await activityService.logTransaction(
                        address,
                        'transaction',
                        'Sent Successfully',
                        `You sent ${sendStore.amount} ${sendStore.selectedToken?.symbol} to ${sendStore.recipientAddress}`,
                        txHash
                    );
                } else {
                    // Multi-send: Log each recipient
                    for (const recipient of sendStore.recipients) {
                        const txHash = `multisend-hash-${Date.now()}`;
                        await apiClient.logTransaction({
                            walletAddress: address,
                            transactionHash: txHash,
                            chainId: parseInt(String(sendStore.selectedChain?.id || '1')),
                            type: 'Sent',
                            fromTokenAddress: sendStore.selectedToken?.id,
                            fromTokenSymbol: sendStore.selectedToken?.symbol,
                            amount: sendStore.amountPerRecipient,
                            amountFormatted: `${sendStore.amountPerRecipient} ${sendStore.selectedToken?.symbol}`,
                            toTokenAddress: recipient.address,
                        });

                        await activityService.logTransaction(
                            address,
                            'transaction',
                            'Multi-Send Success',
                            `You sent ${sendStore.amountPerRecipient} ${sendStore.selectedToken?.symbol} to ${recipient.address}`,
                            txHash
                        );
                    }
                }
            } catch (e) {
                console.error('Failed to log transaction', e);
            }
        }

        setCurrentStep('success');
    };

    const handleSuccessDone = () => {
        resetSendState();
        router.push('/wallet' as any);
    };

    // Render current step
    const renderContent = () => {
        if (currentStep === 'select-asset') {
            return (
                <View style={styles.selectAssetContainer}>
                    <Text style={styles.title}>
                        Select Asset
                    </Text>

                    {/* Tab Switcher */}
                    <View style={styles.tabSwitcher}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setActiveTab('send-to-one')}
                            style={[
                                styles.tab,
                                activeTab === 'send-to-one' && styles.tabActive
                            ]}
                        >
                            <Text style={styles.tabText}>
                                Send to One
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setActiveTab('multi-send')}
                            style={[
                                styles.tab,
                                activeTab === 'multi-send' && styles.tabActive
                            ]}
                        >
                            <Text style={styles.tabText}>
                                Multi-Send
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Token Selector */}
                    <View style={styles.tokenSelectorContainer}>
                        <SendTokenSelector onTokenPress={openTokenSheet} />
                    </View>
                </View>
            );
        } else if (currentStep === 'enter-details') {
            if (activeTab === 'send-to-one') {
                return <SendForm onNext={handleNextFromForm} />;
            } else {
                return <MultiSendForm onNext={handleNextFromForm} />;
            }
        } else if (currentStep === 'review') {
            if (activeTab === 'send-to-one') {
                return <SendReview onConfirm={handleConfirmFromReview} />;
            } else {
                return <MultiSendReview onConfirm={handleConfirmFromReview} />;
            }
        } else if (currentStep === 'passcode') {
            return <PasscodeScreen onSuccess={handlePasscodeSuccess} />;
        } else if (currentStep === 'success') {
            const CheckmarkIcon = require('@/assets/swap/checkmark-circle-01.svg');
            const totalAmount = activeTab === 'send-to-one' ? sendStore.amount : (parseFloat(sendStore.amountPerRecipient) * sendStore.recipients.length).toString();

            return (
                <View style={styles.successContainer}>
                    <View style={styles.successCard}>
                        <View style={styles.iconCircle}>
                            <Image source={CheckmarkIcon} style={{ width: 40, height: 40 }} contentFit="contain" />
                        </View>
                        <Text style={styles.successTitle}>Transaction Successful!</Text>
                        <Text style={styles.successDescription}>
                            Your transaction has been confirmed and the funds are on their way.
                        </Text>

                        <View style={styles.successDetails}>
                            <View style={styles.successDetailItem}>
                                <Text style={styles.successDetailLabel}>Amount</Text>
                                <Text style={styles.successDetailValue}>{totalAmount} {selectedToken?.symbol}</Text>
                            </View>
                            <View style={styles.successDetailItem}>
                                <Text style={styles.successDetailLabel}>Network</Text>
                                <Text style={styles.successDetailValue}>{sendStore.selectedChain?.name}</Text>
                            </View>
                        </View>

                        <TouchableOpacity activeOpacity={0.8} onPress={handleSuccessDone} style={styles.doneButton}>
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
        return null;
    };

    const isNextButtonEnabled = () => {
        if (currentStep === 'select-asset') {
            return !!selectedToken;
        } else if (currentStep === 'enter-details') {
            if (activeTab === 'send-to-one') {
                return (
                    sendStore.recipientAddress.trim().length > 0 &&
                    validateAddress(sendStore.recipientAddress, sendStore.selectedChain?.id).isValid &&
                    parseFloat(sendStore.amount) > 0 &&
                    validateAmount(sendStore.amount).isValid &&
                    sendStore.selectedToken
                );
            } else {
                return (
                    sendStore.recipients.length > 0 &&
                    validateAddresses(sendStore.recipients.map(r => r.address), sendStore.selectedChain?.id).isValid &&
                    parseFloat(sendStore.amountPerRecipient) > 0 &&
                    validateAmount(sendStore.amountPerRecipient).isValid &&
                    sendStore.selectedToken
                );
            }
        }
        return false;
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Sticky Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <WalletHeader
                    walletAddress={WALLET_ADDRESS}
                    onSettingsPress={handleSettingsPress}
                    showBackButton
                    onBackPress={handleBackPress}
                    showIrisScan={false}
                    showSettings={true}
                />
            </View>

            {/* Content */}
            {/* <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            > */}
            <View style={styles.contentWrapper}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingBottom: currentStep === 'select-asset' || currentStep === 'review' ? 100 : 80,
                        }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderContent()}
                </ScrollView>

                {/* Fixed Next Button at Bottom - show on select-asset and enter-details steps */}
                {(currentStep === 'select-asset' || currentStep === 'enter-details') && (
                    <View style={[styles.buttonContainer, { bottom: (bottom || 16) + 32 }]}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={currentStep === 'select-asset' ? handleNextFromSelect : handleNextFromForm}
                            disabled={!isNextButtonEnabled()}
                            style={[
                                styles.nextButton,
                                {
                                    backgroundColor: isNextButtonEnabled() ? colors.primaryCTA : colors.bgCards,
                                }
                            ]}
                        >
                            <Text style={[
                                styles.nextButtonText,
                                {
                                    color: isNextButtonEnabled() ? colors.bg : colors.bodyText,
                                }
                            ]}>
                                Next
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Fixed Confirm Button at Bottom - show on review step */}
                {currentStep === 'review' && (
                    <View style={[styles.buttonContainer, { bottom: (bottom || 16) + 32 }]}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleConfirmFromReview}
                            style={[styles.nextButton, { backgroundColor: colors.primaryCTA }]}
                        >
                            <Text style={[styles.nextButtonText, { color: colors.bg }]}>
                                {activeTab === 'send-to-one' ? 'Confirm' : 'Confirm Multi-Send'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            {/* </KeyboardAvoidingView> */}

            {/* Token Selection Sheet */}
            <SendTokenSelectSheet
                visible={isTokenSheetVisible}
                onClose={closeTokenSheet}
                onSelect={handleTokenSelect}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        backgroundColor: colors.bg,
    },
    keyboardView: {
        flex: 1,
    },
    contentWrapper: {
        flex: 1,
        position: 'relative',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 20,
        alignItems: 'center',
    },
    selectAssetContainer: {
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 20,
    },
    title: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 20,
        lineHeight: 20,
        color: colors.titleText,
        textTransform: 'capitalize',
        textAlign: 'center',
        marginBottom: 47,
    },
    tabSwitcher: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 25,
        width: 357,
        marginBottom: 47,
    },
    tab: {
        height: 46,
        width: 168,
        backgroundColor: 'transparent',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabActive: {
        backgroundColor: colors.bgCards,
    },
    tabText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.bodyText,
    },
    tokenSelectorContainer: {
        width: '100%',
        alignItems: 'flex-end',
    },
    buttonContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        paddingHorizontal: 18,
        alignItems: 'center',
        paddingTop: 16,
    },
    nextButton: {
        width: 353,
        height: 54,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
    },
    // Success Screen Styles
    successContainer: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 40,
    },
    successCard: {
        width: '100%',
        backgroundColor: colors.bgSemi,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        gap: 24,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 20,
        color: colors.titleText,
        textAlign: 'center',
    },
    successDescription: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
        textAlign: 'center',
        lineHeight: 20,
    },
    successDetails: {
        width: '100%',
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 16,
        gap: 12,
    },
    successDetailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    successDetailLabel: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.bodyText,
    },
    successDetailValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    doneButton: {
        width: '100%',
        height: 56,
        borderRadius: 100,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    doneButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.bg,
    },
});
