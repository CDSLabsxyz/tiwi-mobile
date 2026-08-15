import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { getWalletNetwork } from '@/constants/walletNetworks';
import { deriveExportablePrivateKeys, displayOrder, type ExportedKey } from '@/services/exportPrivateKeys';
import { getSecureMnemonic, getSecurePrivateKey } from '@/services/walletCreationService';
import { useWalletStore } from '@/store/walletStore';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../../assets/swap/arrow-left-02.svg');
const CopyIcon = require('../../../../assets/wallet/copy-01.svg');
const DownloadIcon = require('../../../../assets/settings/download-03.svg');

/** Show only the ends of a secret until the user asks to reveal it. */
function maskKey(key: string): string {
    if (key.length <= 12) return '•'.repeat(key.length);
    return `${key.slice(0, 6)}${'•'.repeat(20)}${key.slice(-4)}`;
}

export default function ExportPrivateKeyDisplayScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    const { address, activeGroupId, walletGroups, activeChain } = useWalletStore();

    const [keys, setKeys] = useState<ExportedKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    /** True until the last chain finishes - drives the "more coming" footer. */
    const [isDeriving, setIsDeriving] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const currentGroup = (walletGroups || []).find(w => w.id === activeGroupId);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                // A mnemonic wallet controls every chain, so derive one key per
                // ecosystem instead of showing only the EVM one.
                const evmAddr = currentGroup?.addresses?.EVM;
                const mnemonic = evmAddr ? await getSecureMnemonic(evmAddr) : null;

                if (mnemonic) {
                    // Render each key the moment it resolves. The cheap BIP32
                    // ones land in milliseconds while the Sui/Aptos SDKs take
                    // the best part of a second to initialise - waiting for all
                    // of them left the screen on a spinner.
                    await deriveExportablePrivateKeys(mnemonic, {
                        onKey: (key) => {
                            if (cancelled) return;
                            setIsLoading(false);
                            setKeys(prev => [...prev, key]
                                .sort((a, b) => displayOrder(a.id) - displayOrder(b.id)));
                        },
                    });
                    if (!cancelled) setIsDeriving(false);
                    return;
                }

                // Key-only import: there is exactly one secret and no phrase to
                // derive others from, so show that one under its own chain.
                const chain = activeChain || 'EVM';
                const chainAddr = currentGroup?.addresses?.[chain] ?? address;
                const stored = chainAddr
                    ? (await getSecurePrivateKey(chainAddr, chain)) ?? (await getSecurePrivateKey(chainAddr))
                    : null;

                if (cancelled) return;
                if (stored) {
                    // The network list keys Ethereum as 'ETH'; every other
                    // ChainType matches its network id directly.
                    const networkId = chain === 'EVM' ? 'ETH' : chain;
                    setKeys([{
                        id: networkId,
                        label: getWalletNetwork(networkId)?.name ?? chain,
                        symbol: getWalletNetwork(networkId)?.symbol ?? '',
                        privateKey: stored,
                        format: 'As imported',
                        path: 'Imported directly - not derived from a recovery phrase',
                    }]);
                } else {
                    setError('No private key found for this wallet.');
                }
            } catch (e: any) {
                console.warn('[Export] failed to load keys:', e?.message);
                if (!cancelled) setError('Could not load this wallet’s private keys.');
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                    setIsDeriving(false);
                }
            }
        };

        load();
        return () => { cancelled = true; };
    }, [address, activeGroupId, activeChain]);

    // Never leave decrypted secrets sitting in memory after the screen closes.
    useEffect(() => () => {
        setKeys([]);
        setRevealed({});
    }, []);

    const handleBackPress = useCallback(() => {
        setKeys([]);
        router.replace('/settings/accounts' as any);
    }, [router]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });
        return () => backHandler.remove();
    }, [handleBackPress]);

    const handleCopy = async (key: ExportedKey) => {
        try {
            await Clipboard.setStringAsync(key.privateKey);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopiedId(key.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            console.error('Failed to copy private key');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const writeKeyFile = async () => {
        try {
            const fileContent = JSON.stringify({
                version: 2,
                exported_at: new Date().toISOString(),
                warning: 'UNENCRYPTED. Anyone with this file controls these accounts. Never share it.',
                wallet: currentGroup?.name ?? 'Tiwi Wallet',
                keys: keys.map(k => ({
                    network: k.label,
                    symbol: k.symbol,
                    format: k.format,
                    derivationPath: k.path,
                    covers: k.covers,
                    privateKey: k.privateKey,
                })),
            }, null, 2);

            if (Platform.OS === 'web') {
                const blob = new Blob([fileContent], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `tiwi-private-keys-${Date.now()}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                return;
            }

            const file = new File(Paths.cache, `tiwi-private-keys-${Date.now()}.json`);
            file.create();
            file.write(fileContent);

            if (await Sharing.isAvailableAsync()) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await Sharing.shareAsync(file.uri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Securely Save Private Keys',
                    UTI: 'public.json',
                });
            } else {
                Alert.alert('Sharing Unavailable', 'Your device does not support file sharing.');
            }
        } catch {
            console.error('Failed to export private keys');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to export private keys');
        }
    };

    const handleDownloadAll = () => {
        if (!keys.length) return;
        Alert.alert(
            'Export all private keys?',
            'The file is NOT encrypted. Anyone who opens it can take every asset in this wallet. Save it somewhere only you can reach.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Export', style: 'destructive', onPress: writeKeyFile },
            ],
        );
    };

    const toggleReveal = (id: string) => setRevealed(r => ({ ...r, [id]: !r[id] }));

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity activeOpacity={0.7} onPress={handleBackPress} style={styles.backButton}>
                        <Image source={ChevronLeftIcon} style={styles.fullSize} contentFit="contain" />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>Export Private Key</ThemedText>
                </View>
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <TIWILoader size={100} />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.warningBox}>
                        <ThemedText style={styles.warningText}>
                            Anyone with these keys controls your funds. Never share them, and never
                            type them into a site or app you did not open yourself.
                        </ThemedText>
                    </View>

                    <ThemedText style={styles.subtitle}>
                        {isDeriving
                            ? 'Deriving your keys…'
                            : `${keys.length} ${keys.length === 1 ? 'key' : 'keys'} control every network in this wallet. Networks that share a keypair are listed once.`}
                    </ThemedText>

                    {keys.map((key) => {
                        const isRevealed = !!revealed[key.id];
                        const network = getWalletNetwork(key.id);
                        return (
                            <View key={key.id} style={styles.keyCard}>
                                <View style={styles.keyHeader}>
                                    {!!network?.icon && (
                                        <View style={styles.chainIconCircle}>
                                            <Image source={network.icon} style={styles.fullSize} contentFit="contain" />
                                        </View>
                                    )}
                                    <View style={styles.keyHeaderText}>
                                        <ThemedText style={styles.keyLabel}>{key.label}</ThemedText>
                                        <ThemedText style={styles.keyMeta}>
                                            {key.symbol ? `${key.symbol} · ` : ''}{key.format}
                                        </ThemedText>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => toggleReveal(key.id)}
                                    style={styles.keyBox}
                                >
                                    <ThemedText style={styles.keyText} selectable={isRevealed}>
                                        {isRevealed ? key.privateKey : maskKey(key.privateKey)}
                                    </ThemedText>
                                </TouchableOpacity>

                                {!!key.covers && (
                                    <ThemedText style={styles.coversText}>Also opens: {key.covers}</ThemedText>
                                )}
                                <ThemedText style={styles.pathText}>{key.path}</ThemedText>

                                <View style={styles.keyActions}>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        style={styles.smallButton}
                                        onPress={() => toggleReveal(key.id)}
                                    >
                                        <ThemedText style={styles.smallButtonText}>
                                            {isRevealed ? 'Hide' : 'Reveal'}
                                        </ThemedText>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        style={styles.smallButton}
                                        onPress={() => handleCopy(key)}
                                    >
                                        <View style={styles.smallIcon}>
                                            <Image source={CopyIcon} style={styles.fullSize} contentFit="contain" />
                                        </View>
                                        <ThemedText style={styles.smallButtonText}>
                                            {copiedId === key.id ? 'Copied!' : 'Copy'}
                                        </ThemedText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}

                    {isDeriving && (
                        <View style={styles.derivingRow}>
                            <TIWILoader size={28} />
                            <ThemedText style={styles.derivingText}>
                                Loading the remaining networks…
                            </ThemedText>
                        </View>
                    )}

                    {/* Disabled until every chain has resolved - exporting mid-
                        derivation would silently write an incomplete key file. */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleDownloadAll}
                        style={[styles.downloadButton, (!keys.length || isDeriving) && styles.disabledButton]}
                        disabled={!keys.length || isDeriving}
                    >
                        <View style={styles.smallIcon}>
                            <Image source={DownloadIcon} style={styles.fullSize} contentFit="contain" />
                        </View>
                        <ThemedText style={styles.downloadText}>Download all keys</ThemedText>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20 },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 68,
        paddingVertical: 10,
    },
    backButton: { width: 24, height: 24 },
    headerTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        lineHeight: 20,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    errorText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 15,
        color: '#FF5C5C',
        textAlign: 'center',
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 12 },
    warningBox: {
        backgroundColor: 'rgba(255, 92, 92, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 92, 92, 0.3)',
        borderRadius: 14,
        padding: 14,
    },
    warningText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 13,
        lineHeight: 19,
        color: '#FF8A8A',
    },
    subtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        lineHeight: 19,
        color: colors.mutedText,
        marginBottom: 4,
    },
    keyCard: {
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        padding: 16,
        gap: 10,
    },
    keyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    chainIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    keyHeaderText: { flex: 1 },
    keyLabel: { fontFamily: 'Manrope-SemiBold', fontSize: 15 },
    keyMeta: { fontFamily: 'Manrope-Regular', fontSize: 12, color: colors.mutedText },
    keyBox: {
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    keyText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        lineHeight: 20,
    },
    coversText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        lineHeight: 17,
        color: colors.mutedText,
    },
    pathText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 11,
        color: '#5F6B5C',
    },
    keyActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
    smallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flex: 1,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.bgCards,
    },
    smallButtonText: { fontFamily: 'Manrope-SemiBold', fontSize: 13 },
    smallIcon: { width: 16, height: 16 },
    downloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.bgCards,
        marginTop: 8,
    },
    downloadText: { fontFamily: 'Manrope-SemiBold', fontSize: 15 },
    disabledButton: { opacity: 0.4 },
    derivingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 8,
    },
    derivingText: {
        fontFamily: 'Manrope-Regular',
        fontSize: 13,
        color: colors.mutedText,
    },
    fullSize: { width: '100%', height: '100%' },
});
