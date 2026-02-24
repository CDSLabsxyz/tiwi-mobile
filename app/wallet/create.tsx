import { ProcessingOverlay } from '@/components/ui/ProcessingOverlay';
import FinalizeStep from '@/components/wallet/creation/FinalizeStep';
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

type CreateStep = 'selection' | 'finalize';

export default function CreateWalletScreen() {
    const router = useRouter();
    const [step, setStep] = useState<CreateStep>('selection');
    const [wallet, setWallet] = useState<CreatedWallet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { addWalletGroup } = useWalletStore();

    const handleBack = () => {
        if (step === 'selection') {
            router.back();
        } else {
            setStep('selection');
        }
    };

    const handleSelectMethod = async () => {
        setIsLoading(true);

        // Allow one frame for the overlay to mount before starting heavy generation
        await new Promise(resolve => setTimeout(resolve, 50));

        // Artificial delay for premium high-fidelity feel (3s)
        const timer = new Promise(resolve => setTimeout(resolve, 3000));
        try {
            // 1. Generate new wallet
            const newWallet = generateNewWallet();

            // 2. Derive & Save Securely (Address, PK, Mnemonic)
            const { derivePrivateKeyFromMnemonic, saveSecureWallet, saveSecureMnemonic } = await import('@/services/walletCreationService');
            const privateKey = `0x${derivePrivateKeyFromMnemonic(newWallet.mnemonic)}`;

            await saveSecureWallet(newWallet.address, privateKey);
            await saveSecureMnemonic(newWallet.address, newWallet.mnemonic);

            // Ensure we wait for the timer
            await timer;

            // 3. Set wallet state and move to finalize
            setWallet(newWallet);
            setStep('finalize');
        } catch (error) {
            console.error('Failed to create wallet:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const { setSetupPhase } = useSecurityStore();

    const handleFinalize = async () => {
        if (wallet) {
            addWalletGroup({
                id: Date.now().toString(),
                name: 'Wallet 1',
                type: 'mnemonic',
                primaryChain: 'EVM',
                addresses: wallet.addresses,
                source: 'internal'
            });
            // Update setup phase to persist progress
            setSetupPhase('WALLET_READY');
            // Redirect directly to Security flow
            router.push('/security' as any);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Wallet</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {step === 'selection' && (
                    <SelectionStep onSelect={handleSelectMethod} />
                )}
                {step === 'finalize' && wallet && (
                    <FinalizeStep address={wallet.address} onComplete={handleFinalize} />
                )}
            </View>

            <ProcessingOverlay
                isVisible={isLoading}
                title="Creating wallet..."
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
