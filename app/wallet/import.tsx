import { ProcessingOverlay } from '@/components/ui/ProcessingOverlay';
import { QRScanner } from '@/components/ui/QRScanner';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { NetworkSelectionModal } from '@/components/wallet/NetworkSelectionModal';
import { colors } from '@/constants/colors';
import {
    getCompatibleChains,
    importWalletByMnemonic,
    importWalletByPrivateKey,
    validateMnemonic,
    validatePrivateKey
} from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { ChainType, useWalletStore } from '@/store/walletStore';
import { api } from '@/lib/mobile/api-client';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function ImportWalletScreen() {
    const router = useRouter();
    const { mode } = useLocalSearchParams<{ mode?: string }>();
    const { addWalletGroup } = useWalletStore();

    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [showNetworkModal, setShowNetworkModal] = useState(false);

    const handleScan = (data: string) => {
        // Basic sanitization
        const sanitized = data.trim();
        setInputText(sanitized);
    };

    // Validation Logic
    const validation = useMemo(() => {
        const text = inputText.trim();
        if (!text) return { isValid: false, type: null, error: null };

        const isMnemonic = validateMnemonic(text);
        const isPK = validatePrivateKey(text);

        if (isMnemonic) return { isValid: true, type: 'mnemonic', error: null };
        if (isPK) return { isValid: true, type: 'privateKey', error: null };

        // If it looks like a seed phrase but invalid
        if (text.split(/\s+/).length >= 12) {
            return { isValid: false, type: 'mnemonic', error: 'The seed phrase is invalid' };
        }

        if (text.length > 30) {
            return { isValid: false, type: 'privateKey', error: 'The private key is invalid' };
        }

        return { isValid: false, type: null, error: null };
    }, [inputText]);

    // Detect compatible chains for the current input
    const compatibleChains = useMemo(() => {
        return getCompatibleChains(inputText);
    }, [inputText]);

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        setInputText(text);
    };

    const { setupPhase, setSetupPhase } = useSecurityStore();

    const handleContinue = async () => {
        if (!validation.isValid) return;
        setShowNetworkModal(true);
    };

    const handleNetworkSelect = async (selected: ChainType | 'MULTI') => {
        // Close network modal immediately so the loader shows instantly
        setShowNetworkModal(false);
        // Defer setIsLoading to next tick so the modal close animation doesn't block
        requestAnimationFrame(() => setIsLoading(true));

        try {
            let importedWallet;
            if (validation.type === 'mnemonic') {
                importedWallet = await importWalletByMnemonic(inputText.trim());
            } else {
                const chain = selected === 'MULTI' ? 'EVM' : selected;
                importedWallet = await importWalletByPrivateKey(inputText.trim(), chain);
            }

            addWalletGroup({
                id: importedWallet.address.toLowerCase(),
                name: `Wallet ${useWalletStore.getState().walletGroups.length + 1}`,
                type: validation.type === 'mnemonic' ? 'mnemonic' : 'privateKey',
                primaryChain: (selected === 'MULTI' ? 'EVM' : selected) as ChainType,
                addresses: importedWallet.addresses,
                source: 'imported',
                // Imported wallets already have a seed/key stored externally — no in-app backup needed.
                isBackupComplete: true,
            });

            // Kick off balance prefetch immediately (non-blocking) so by the time
            // the user lands on the wallet tab, balances are already cached.
            const evmAddr = importedWallet.addresses?.EVM;
            if (evmAddr) {
                api.wallet.balances({
                    address: evmAddr,
                    chains: [1, 56, 137, 42161, 8453, 10, 43114]
                }).catch(() => null);
            }
            const solAddr = importedWallet.addresses?.SOLANA;
            if (solAddr) {
                api.wallet.balances({ address: solAddr, chains: [7565164] }).catch(() => null);
            }
            const tronAddr = importedWallet.addresses?.TRON;
            if (tronAddr) {
                api.wallet.balances({ address: tronAddr, chains: [728126428] }).catch(() => null);
            }

            // Navigate immediately — don't wait for balance fetch
            if (mode === 'additional' || setupPhase === 'COMPLETED') {
                router.replace('/(tabs)' as any);
            } else {
                setSetupPhase('WALLET_READY');
                router.push('/security' as any);
            }
        } catch (error) {
            console.error('Import failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    const inputBorderColor = useMemo(() => {
        if (!inputText) return '#1F261E';
        if (validation.error) return '#FF5C5C';
        if (validation.isValid) return colors.primaryCTA;
        return '#1F261E';
    }, [inputText, validation]);

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Import Wallet</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    {/* Input Area */}
                    <View style={[styles.inputWrapper, { borderColor: inputBorderColor }]}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter seed phrase or private key"
                            placeholderTextColor="#6E7873"
                            multiline
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={inputText}
                            onChangeText={setInputText}
                            textAlignVertical="top"
                        />
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={() => setShowScanner(true)}
                        >
                            <MaterialCommunityIcons name="qrcode-scan" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Hint / Error */}
                    <View style={styles.infoRow}>
                        {validation.error && (
                            <Text style={styles.errorText}>{validation.error}</Text>
                        )}
                    </View>

                    {/* Paste Button */}
                    <TouchableOpacity style={[styles.pasteButton, { marginBottom: 40 }]} onPress={handlePaste}>
                        <Text style={styles.pasteText}>Paste</Text>
                        <Ionicons name="clipboard-outline" size={16} color={colors.primaryCTA} />
                    </TouchableOpacity>

                    {/* Footer Button */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[
                                styles.continueButton,
                                { opacity: (validation.isValid && !isLoading) ? 1 : 0.5 }
                            ]}
                            onPress={handleContinue}
                            disabled={!validation.isValid || isLoading}
                        >
                            {isLoading ? (
                                <TIWILoader size={40} />
                            ) : (
                                <Text style={styles.continueButtonText}>Continue</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>


            <QRScanner
                isVisible={showScanner}
                onClose={() => setShowScanner(false)}
                onScan={handleScan}
            />

            <NetworkSelectionModal
                visible={showNetworkModal}
                onClose={() => setShowNetworkModal(false)}
                onSelect={handleNetworkSelect}
                mode={validation.type === 'mnemonic' ? 'mnemonic' : 'privateKey'}
                compatibleChains={compatibleChains}
            />

            <ProcessingOverlay
                isVisible={isLoading}
                title="Importing wallet..."
                subtitles={[
                    "Recovering your digital legacy.",
                    "The Tiwi Protocol welcomes you back.",
                    "Synchronizing your multi-chain balances...",
                    "Unlocking a world of borderless finance.",
                    "Ready to swap, trade, and earn."
                ]}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 40,
    },
    inputWrapper: {
        height: 275,
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderRadius: 24,
        padding: 24,
        position: 'relative',
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        lineHeight: 24,
    },
    scanButton: {
        position: 'absolute',
        bottom: 24,
        right: 24,
    },
    infoRow: {
        marginTop: 12,
        minHeight: 20,
    },
    hintText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: '#6E7873',
    },
    errorText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        color: '#FF5C5C',
    },
    pasteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        marginTop: 60,
    },
    pasteText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    footer: {
        marginTop: 'auto',
        marginBottom: 40,
    },
    continueButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#010501',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    successCard: {
        width: '100%',
        backgroundColor: '#0B0F0A',
        borderWidth: 1,
        borderColor: '#1F261E',
        borderRadius: 32,
        padding: 20,
        alignItems: 'center',
    },
    successIconWrapper: {
        marginTop: 24,
        marginBottom: 32,
    },
    circleIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(177, 241, 40, 0.1)',
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    successSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: '#B5B5B5',
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
    },
    doneButton: {
        width: '100%',
        backgroundColor: colors.primaryCTA,
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    doneButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: '#010501',
    },
});
