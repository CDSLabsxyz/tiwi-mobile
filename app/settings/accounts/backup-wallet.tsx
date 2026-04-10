import SeedConfirmStep from '@/components/wallet/creation/SeedConfirmStep';
import SeedDisplayStep from '@/components/wallet/creation/SeedDisplayStep';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { getSecureMnemonic } from '@/services/walletCreationService';
import { useWalletStore } from '@/store/walletStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type BackupStep = 'display' | 'confirm' | 'done';

/**
 * Backup-from-settings flow.
 *
 * Loads the mnemonic for the active wallet from SecureStore, has the user
 * confirm it via the existing SeedConfirmStep, then marks the wallet as
 * backed up. Used when a user originally bypassed the manual backup during
 * wallet creation.
 */
export default function BackupWalletScreen() {
    const router = useRouter();
    const activeGroupId = useWalletStore(s => s.activeGroupId);
    const activeAddress = useWalletStore(s => s.activeAddress);
    const walletGroups = useWalletStore(s => s.walletGroups);
    const markBackupComplete = useWalletStore(s => s.markBackupComplete);

    const activeGroup = walletGroups.find(g => g.id === activeGroupId);
    const mnemonicAddress = activeGroup?.addresses.EVM || activeAddress || activeGroupId;

    const [mnemonic, setMnemonic] = useState<string | null>(null);
    const [step, setStep] = useState<BackupStep>('display');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!mnemonicAddress) {
                setError('No active wallet found.');
                return;
            }
            try {
                const m = await getSecureMnemonic(mnemonicAddress);
                if (cancelled) return;
                if (!m) {
                    setError('Could not load seed phrase for this wallet.');
                    return;
                }
                setMnemonic(m);
            } catch (e) {
                console.error('Failed to load mnemonic for backup:', e);
                if (!cancelled) setError('Failed to load seed phrase.');
            }
        })();
        return () => { cancelled = true; };
    }, [mnemonicAddress]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBack();
            return true;
        });
        return () => sub.remove();
    }, [step]);

    const handleBack = () => {
        if (step === 'confirm') {
            setStep('display');
            return;
        }
        if (router.canGoBack()) router.back();
        else router.replace('/settings/accounts' as any);
    };

    const handleConfirmed = () => {
        if (activeGroupId) markBackupComplete(activeGroupId);
        setStep('done');
    };

    return (
        <SafeAreaView style={styles.container}>
            <CustomStatusBar />
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Backup Wallet</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {error && (
                    <View style={styles.errorWrap}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {!error && !mnemonic && (
                    <View style={styles.loaderWrap}>
                        <ActivityIndicator color={colors.primaryCTA} />
                    </View>
                )}

                {!error && mnemonic && step === 'display' && (
                    <SeedDisplayStep
                        mnemonic={mnemonic}
                        onContinue={() => setStep('confirm')}
                    />
                )}

                {!error && mnemonic && step === 'confirm' && (
                    <SeedConfirmStep
                        mnemonic={mnemonic}
                        onConfirm={handleConfirmed}
                    />
                )}

                {!error && step === 'done' && (
                    <View style={styles.doneWrap}>
                        <View style={styles.doneIcon}>
                            <Ionicons name="checkmark" size={40} color="#010501" />
                        </View>
                        <Text style={styles.doneTitle}>Backup Complete</Text>
                        <Text style={styles.doneSubtitle}>
                            Your seed phrase has been verified. You can now send, swap, stake, and export your keys.
                        </Text>
                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={() => router.replace('/settings/accounts' as any)}
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    content: { flex: 1 },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorWrap: { padding: 20 },
    errorText: { color: '#FF5C5C', fontFamily: 'Manrope-Medium', fontSize: 14, textAlign: 'center' },
    doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
    doneIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    doneTitle: { fontFamily: 'Manrope-Bold', fontSize: 22, color: '#FFFFFF', textAlign: 'center' },
    doneSubtitle: { fontFamily: 'Manrope-Regular', fontSize: 14, color: '#B5B5B5', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    doneButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneButtonText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: '#010501' },
});
