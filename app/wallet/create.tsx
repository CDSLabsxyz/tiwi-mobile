import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { SuccessModal } from '@/components/ui/SuccessModal';
import BackupStep from '@/components/wallet/creation/BackupStep';
import FinalizeStep from '@/components/wallet/creation/FinalizeStep';
import SelectionStep from '@/components/wallet/creation/SelectionStep';
import VerifyStep from '@/components/wallet/creation/VerifyStep';
import { colors } from '@/constants/colors';
import { CreatedWallet, generateNewWallet } from '@/services/walletCreationService';
import { useWalletStore } from '@/store/walletStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CreateStep = 'selection' | 'backup' | 'verify' | 'finalize';

export default function CreateWalletScreen() {
    const router = useRouter();
    const [step, setStep] = useState<CreateStep>('selection');
    const [wallet, setWallet] = useState<CreatedWallet | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { setConnection } = useWalletStore();

    const handleBack = () => {
        if (step === 'selection') {
            router.back();
        } else if (step === 'backup') {
            setStep('selection');
        } else if (step === 'verify') {
            setStep('backup');
        } else if (step === 'finalize') {
            setStep('selection');
        }
    };

    const handleSelectMethod = async () => {
        setIsLoading(true);
        // Artificial delay for high-fidelity feel as requested
        setTimeout(() => {
            const newWallet = generateNewWallet();
            setWallet(newWallet);
            setStep('backup');
            setIsLoading(false);
        }, 2000);
    };

    const handleBackupComplete = () => {
        setStep('verify');
    };

    const handleVerifyComplete = async () => {
        if (wallet) {
            setIsLoading(true);
            try {
                // 1. Derive Private Key
                const { derivePrivateKeyFromMnemonic, saveSecureWallet, saveSecureMnemonic } = await import('@/services/walletCreationService');
                const privateKey = `0x${derivePrivateKeyFromMnemonic(wallet.mnemonic)}`;

                // 2. Save Securely
                await saveSecureWallet(wallet.address, privateKey);
                await saveSecureMnemonic(wallet.address, wallet.mnemonic);

                // 3. Move to finalize
                setStep('finalize');
            } catch (error) {
                console.error('Failed to secure wallet:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleFinalize = async () => {
        if (wallet) {
            setConnection({
                address: wallet.address,
                chainId: 1,
                isConnected: true,
                source: 'internal',
            });
            setIsSuccess(true);
        }
    };

    const handleSuccessDone = () => {
        setIsSuccess(false);
        router.push('/security' as any);
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
                {step === 'backup' && wallet && (
                    <BackupStep mnemonic={wallet.mnemonic} onComplete={handleBackupComplete} />
                )}
                {step === 'verify' && wallet && (
                    <VerifyStep
                        mnemonic={wallet.mnemonic}
                        onComplete={handleVerifyComplete}
                        onCancel={() => setStep('backup')}
                    />
                )}
                {step === 'finalize' && wallet && (
                    <FinalizeStep address={wallet.address} onComplete={handleFinalize} />
                )}
            </View>

            <SuccessModal
                isVisible={isSuccess}
                type="created"
                onDone={handleSuccessDone}
            />

            {isLoading && <LoadingOverlay />}
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
