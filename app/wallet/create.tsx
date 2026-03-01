import { ProcessingOverlay } from '@/components/ui/ProcessingOverlay';
import FinalizeStep from '@/components/wallet/creation/FinalizeStep';
import SeedConfirmStep from '@/components/wallet/creation/SeedConfirmStep';
import SeedDisplayStep from '@/components/wallet/creation/SeedDisplayStep';
import SelectionStep from '@/components/wallet/creation/SelectionStep';
import { colors } from '@/constants/colors';
import { CreatedWallet, generateNewWallet } from '@/services/walletCreationService';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CreateStep = 'selection' | 'display_seed' | 'confirm_seed' | 'finalize';

export default function CreateWalletScreen() {
    const router = useRouter();
    const [step, setStep] = useState<CreateStep>('selection');
    const [wallet, setWallet] = useState<CreatedWallet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { addWalletGroup } = useWalletStore();
    const { setSetupPhase } = useSecurityStore();

    const handleBack = () => {
        if (step === 'selection') {
            router.back();
        } else if (step === 'display_seed') {
            setStep('selection');
            setWallet(null);
        } else if (step === 'confirm_seed') {
            setStep('display_seed');
        } else if (step === 'finalize') {
            // Once in finalize, the wallet is written. Prevent going back to steps.
            router.push('/security' as any);
        }
    };

    const handleSelectMethod = async () => {
        setIsLoading(true);
        // Allow one frame for the overlay to mount before starting heavy generation
        await new Promise(resolve => setTimeout(resolve, 50));
        // Artificial delay for premium high-fidelity feel
        const timer = new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // 1. Generate new wallet in memory
            const newWallet = generateNewWallet();
            await timer;

            // 2. Set wallet state and proceed to display seed
            setWallet(newWallet);
            setStep('display_seed');
        } catch (error) {
            console.error('Failed to create wallet:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmSeed = async () => {
        if (!wallet) return;
        setIsLoading(true);

        try {
            // 1. Derive & Save Securely (Address, PK, Mnemonic)
            const { derivePrivateKeyFromMnemonic, saveSecureWallet, saveSecureMnemonic } = await import('@/services/walletCreationService');
            const privateKey = `0x${derivePrivateKeyFromMnemonic(wallet.mnemonic)}`;

            await saveSecureWallet(wallet.address, privateKey);
            await saveSecureMnemonic(wallet.address, wallet.mnemonic);

            // 2. Move to finalize
            setStep('finalize');
        } catch (error) {
            console.error('Failed to securely save wallet:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (wallet) {
            const { setupPhase, setSetupPhase } = useSecurityStore.getState();

            addWalletGroup({
                id: wallet.address.toLowerCase(),
                name: `Wallet ${useWalletStore.getState().walletGroups.length + 1}`,
                type: 'mnemonic',
                primaryChain: 'EVM',
                addresses: wallet.addresses,
                source: 'internal'
            });

            // Update setup phase ONLY if we haven't completed it yet
            if (setupPhase !== 'COMPLETED') {
                setSetupPhase('WALLET_READY');
                router.push('/security' as any);
            } else {
                // If already setup, go explicitly to tabs to ensure we hit the dashboard
                router.replace('/(tabs)' as any);
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {step !== 'finalize' ? (
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
                <Text style={styles.headerTitle}>Create Wallet</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {step === 'selection' && (
                    <SelectionStep onSelect={handleSelectMethod} />
                )}
                {step === 'display_seed' && wallet && (
                    <SeedDisplayStep
                        mnemonic={wallet.mnemonic}
                        onContinue={() => setStep('confirm_seed')}
                    />
                )}
                {step === 'confirm_seed' && wallet && (
                    <SeedConfirmStep
                        mnemonic={wallet.mnemonic}
                        onConfirm={handleConfirmSeed}
                    />
                )}
                {step === 'finalize' && wallet && (
                    <FinalizeStep address={wallet.address} onComplete={handleFinalize} />
                )}
            </View>

            <ProcessingOverlay
                isVisible={isLoading}
                title={step === 'confirm_seed' ? "Securing wallet..." : "Creating wallet..."}
                subtitles={[
                    "Your decentralized identity is being born.",
                    "Securing your assets with industrial-grade encryption.",
                    "Preparing seamless cross-chain payments.",
                    "Syncing with the Tiwi Protocol ecosystem.",
                    "The future of finance, at your fingertips."
                ]}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
        marginTop: 10,
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
    },
});
