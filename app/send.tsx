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
import { useTransactionExecution } from '@/hooks/useTransactionExecution';
import { apiClient } from '@/services/apiClient';
import { fetchWalletData } from '@/services/walletService';
import { useSendStore } from '@/store/sendStore';
import { useWalletStore } from '@/store/walletStore';
import { validateAddress, validateAddresses, validateAmount } from '@/utils/addressValidation';
import { mapAssetToTokenOption } from '@/utils/assetMapping';
import { isNativeToken } from '@/utils/wallet';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SendScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const pathname = usePathname();

    // Animation for processing orbit
    const rotation = useSharedValue(0);
    const pulse = useSharedValue(1);



    const orbitPlanetStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
        ],
    }));

    const orbitIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));
    const params = useLocalSearchParams<{
        assetId?: string;
        symbol?: string;
        name?: string;
        balance?: string;
        usdValue?: string;
        chainId?: string;
        logo?: string;
        priceUSD?: string;
        address?: string;
        decimals?: string;
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

    const { address: walletAddress, walletGroups } = useWalletStore();
    const { data: chains } = useChains();
    const { execute, executeMulti, isExecuting } = useTransactionExecution();

    useEffect(() => {
        if (isExecuting) {
            rotation.value = withRepeat(
                withTiming(360, { duration: 2000, easing: Easing.linear }),
                -1,
                false
            );
            pulse.value = withRepeat(
                withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            rotation.value = 0;
            pulse.value = 1;
        }
    }, [isExecuting]);

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
                address: params.address,
                decimals: params.decimals ? Number(params.decimals) : undefined,
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

        if (params.assetId && walletAddress) {
            // Fallback: fetch from wallet data if we only have ID
            const loadAsset = async () => {
                try {
                    const walletData = await fetchWalletData(walletAddress);
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
        } else if (walletAddress && chains) {
            try {
                if (walletAddress) {
                    const res = await apiClient.getWalletBalances(walletAddress);
                    const asset = res?.balances?.find((a: any) => a.symbol === token.symbol);
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

    const handleConfirmFromReview = async () => {
        // Multi-send logic placeholder
        if (activeTab === 'multi-send') {
            setCurrentStep('passcode');
            return;
        }

        // Check if active wallet is local or external
        const wallet = walletGroups.find((g: any) => {
            return Object.values(g.addresses).some((addr: any) => addr?.toLowerCase() === walletAddress?.toLowerCase());
        });
        const isLocal = wallet?.source === 'local' || wallet?.source === 'internal' || wallet?.source === 'imported';

        if (isLocal) {
            // Local wallet needs passcode
            setCurrentStep('passcode');
        } else {
            // External wallet triggers own popup
            try {
                await performTransaction();
            } catch (e) {
                // Error already handled in performTransaction or hook
            }
        }
    };

    const performTransaction = async () => {
        if (!selectedToken || !sendStore.selectedChain) {
            return;
        }

        try {
            let hash: string | undefined;

            if (activeTab === 'send-to-one') {
                if (!sendStore.recipientAddress || !sendStore.amount) return;
                hash = await execute({
                    tokenAddress: selectedToken.address,
                    symbol: selectedToken.symbol,
                    decimals: selectedToken.decimals,
                    recipientAddress: sendStore.recipientAddress,
                    amount: sendStore.amount,
                    chainId: Number(sendStore.selectedChain.id),
                    isNative: isNativeToken(selectedToken.address),
                });
            } else {
                if (sendStore.recipients.length === 0 || !sendStore.amountPerRecipient) return;
                hash = await executeMulti({
                    tokenAddress: selectedToken.address,
                    symbol: selectedToken.symbol,
                    decimals: selectedToken.decimals,
                    recipients: sendStore.recipients.map(r => r.address),
                    amounts: sendStore.recipients.map(() => sendStore.amountPerRecipient),
                    chainId: Number(sendStore.selectedChain.id),
                    isNative: isNativeToken(selectedToken.address),
                });
            }

            if (hash) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setCurrentStep('success');
            }
        } catch (e) {
            console.error('Send failed:', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handlePasscodeSuccess = async () => {
        console.log('Passcode verified, executing transaction...');
        await performTransaction();
    };

    const handleSuccessDone = () => {
        resetSendState();
        router.replace('/(tabs)/wallet' as any);
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
                    sendStore.selectedToken &&
                    !sendStore.isInsufficientBalance
                );
            } else {
                return (
                    sendStore.recipients.length > 0 &&
                    validateAddresses(sendStore.recipients.map(r => r.address), sendStore.selectedChain?.id).isValid &&
                    parseFloat(sendStore.amountPerRecipient) > 0 &&
                    validateAmount(sendStore.amountPerRecipient).isValid &&
                    sendStore.selectedToken &&
                    !sendStore.isInsufficientBalance
                );
            }
        }
        return false;
    };


    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <CustomStatusBar />

            {/* Sticky Header */}
            {currentStep !== 'passcode' && (
                <View style={[styles.header, { paddingTop: top || 0 }]}>
                    <WalletHeader
                        walletAddress={walletAddress || '0x'}
                        onSettingsPress={handleSettingsPress}
                        showBackButton
                        onBackPress={handleBackPress}
                        showIrisScan={false}
                        showSettings={true}
                    />
                </View>
            )}

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
                            flex: currentStep === 'passcode' ? 1 : 0, // Ensure it fills screen if passcode
                            paddingHorizontal: currentStep === 'passcode' ? 0 : 18,
                            paddingTop: currentStep === 'passcode' ? 0 : 20,
                        }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={currentStep !== 'passcode'}
                >
                    {renderContent()}
                </ScrollView>

                {/* Processing Overlay */}
                {isExecuting && (
                    <View style={styles.processingOverlay}>
                        <View style={styles.processingContent}>
                            <View style={styles.orbitContainer}>
                                <View style={styles.orbitCircle} />
                                <Animated.View style={[styles.orbitPlanetWrapper, orbitPlanetStyle]}>
                                    <View style={styles.orbitPlanet} />
                                </Animated.View>
                                <Animated.Image
                                    source={require('@/assets/images/full logo.svg')}
                                    style={[styles.orbitIcon, orbitIconStyle]}
                                // contentFit="contain"
                                />
                            </View>
                            <Text style={styles.processingTitle}>Processing Transaction</Text>
                            <Text style={styles.processingSubtitle}>
                                {activeTab === 'send-to-one'
                                    ? `Sending ${sendStore.amount} ${selectedToken?.symbol} to ${sendStore.recipientAddress.slice(0, 6)}...`
                                    : 'Processing your multi-send request...'}
                            </Text>
                            <Text style={styles.processingStatus}>Broadcasting to {sendStore.selectedChain?.name}...</Text>
                        </View>
                    </View>
                )}

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

                {currentStep === 'review' && (
                    <View style={[styles.buttonContainer, { bottom: (bottom || 16) + 32 }]}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleConfirmFromReview}
                            disabled={isExecuting || sendStore.isInsufficientGas}
                            style={[
                                styles.nextButton,
                                {
                                    backgroundColor: (isExecuting || sendStore.isInsufficientGas) ? colors.bgCards : colors.primaryCTA
                                }
                            ]}
                        >
                            {isExecuting ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primaryCTA, borderTopColor: 'transparent' }} />
                                    <Text style={[styles.nextButtonText, { color: colors.bodyText }]}>
                                        {sendStore.isInsufficientGas ? 'Insufficient Gas' : 'Processing...'}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={[
                                    styles.nextButtonText,
                                    { color: (isExecuting || sendStore.isInsufficientGas) ? colors.bodyText : colors.bg }
                                ]}>
                                    {sendStore.isInsufficientGas
                                        ? `Insufficient ${sendStore.selectedChain?.id === 56 ? 'BNB' : (sendStore.selectedChain?.id === 1 ? 'ETH' : 'Native')} for gas`
                                        : (activeTab === 'send-to-one' ? 'Confirm' : 'Confirm Multi-Send')}
                                </Text>
                            )}
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
    // Processing Overlay Styles
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 1000,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    processingContent: {
        alignItems: 'center',
        gap: 16,
    },
    orbitContainer: {
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    orbitCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        position: 'absolute',
    },
    orbitPlanetWrapper: {
        position: 'absolute',
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    orbitPlanet: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primaryCTA,
        marginTop: -6, // Center on the orbit line
    },
    orbitIcon: {
        width: 50,
        height: 50,
    },
    processingTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    processingSubtitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        lineHeight: 20,
    },
    processingStatus: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.primaryCTA,
        backgroundColor: 'rgba(11, 234, 147, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        marginTop: 8,
    }
});
