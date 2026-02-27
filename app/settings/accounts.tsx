import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useChains } from '@/hooks/useChains';
import { Chain } from '@/services/apiClient';
import { useWalletStore } from '@/store/walletStore';
import { truncateAddress } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Assets
const ChevronLeftIcon = require('@/assets/settings/arrow-left-02.svg');
const PencilEditIcon = require('@/assets/settings/pencil-edit-01.svg');
const CloudUploadIcon = require('@/assets/settings/cloud-upload.svg');
const LogoutIcon = require('@/assets/wallet/logout-01.svg');
const CopyIcon = require('@/assets/wallet/copy-01.svg');
const IrisScanIcon = require('@/assets/home/iris-scan.svg');
const ChainIcon = require('@/assets/home/chains/bsc.svg');

export default function AccountSettingsScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { activeAddress: address, name, walletGroups: connectedWallets = [] } = useWalletStore();
    const [copied, setCopied] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);

    // Fetch chains using our custom hook
    const chainsResult = useChains();
    const allChains = chainsResult.data || [];
    const isLoadingChains = chainsResult.isLoading;

    // Find current wallet to get source and type
    const currentWallet = (connectedWallets || []).find(w =>
        Object.values(w.addresses || {}).some(addr => addr?.toLowerCase() === address?.toLowerCase())
    );
    const isLocalWallet = currentWallet?.source === 'internal' || currentWallet?.source === 'imported' || currentWallet?.source === 'local';
    const accountType = isLocalWallet ? 'Non-custodial' : 'External Wallet';

    // Track compatible chains
    const getCompatibleChains = () => {
        if (!currentWallet) return [];

        // Filter by wallet type (evm/solana)
        const walletType = currentWallet?.primaryChain?.toLowerCase() === 'solana' ? 'solana' : 'evm';
        const filtered = allChains.filter((c: Chain) => c.type?.toLowerCase() === walletType);

        // Ensure BNB is always included if EVM
        if (walletType === 'evm') {
            const bnbChain = allChains.find((c: Chain) => c.id === 56);
            const hasBnb = filtered.some((c: Chain) => c.id === 56);
            if (bnbChain && !hasBnb) {
                filtered.unshift(bnbChain);
            } else if (bnbChain && hasBnb) {
                // Move BNB to front
                const index = filtered.findIndex((c: Chain) => c.id === 56);
                if (index > -1) {
                    const [bnb] = filtered.splice(index, 1);
                    filtered.unshift(bnb);
                }
            }
        }

        return filtered.slice(0, 8);
    };

    const compatibleChains = getCompatibleChains();

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, []);

    const handleBackPress = () => {
        router.replace('/settings' as any);
    };

    const handleCopyAddress = async () => {
        if (!address) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await Clipboard.setStringAsync(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy address:', error);
        }
    };

    const handleReceivePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowReceiveModal(true);
    };

    const actions = [
        { label: 'Edit Wallet Name', icon: PencilEditIcon, route: '/settings/accounts/edit-wallet-name', visible: true },
        { label: 'Export Private Key', icon: CloudUploadIcon, route: '/settings/accounts/export-private-key', visible: isLocalWallet },
        { label: 'Export Recovery Phrase', icon: CloudUploadIcon, route: '/settings/accounts/export-recovery-phrase', visible: isLocalWallet && currentWallet?.source === 'local' },
        { label: 'Disconnect Wallet', icon: LogoutIcon, route: '/settings/accounts/disconnect-wallet', destructive: true, visible: true },
    ].filter(a => a.visible);

    const connectedNetworks = Array(8).fill(null);

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            {/* Header - Matching Figma: 68px gap */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <ThemedText style={styles.headerTitle}>
                        Account Settings
                    </ThemedText>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
            >
                {/* Wallet Info Section - Matching Figma: 20px gap between items */}
                <View style={styles.infoSection}>
                    {/* Wallet Name */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Wallet Name:</ThemedText>
                        <ThemedText style={styles.infoValue}>{name || 'Wallet 1'}</ThemedText>
                    </View>

                    {/* Wallet Address */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Wallet Address:</ThemedText>
                        <View style={styles.addressContainer}>
                            <ThemedText style={styles.infoValue}>
                                {address ? truncateAddress(address) : 'No address'}
                            </ThemedText>
                            <View style={styles.addressActions}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handleCopyAddress}
                                    style={styles.smallActionIcon}
                                >
                                    <View style={styles.iconContainer}>
                                        <Image
                                            source={CopyIcon}
                                            style={styles.fullSize}
                                            contentFit="contain"
                                        />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handleReceivePress}
                                    style={styles.smallActionIcon}
                                >
                                    <View style={styles.iconContainer}>
                                        <Image
                                            source={IrisScanIcon}
                                            style={styles.fullSize}
                                            contentFit="contain"
                                        />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {copied && <ThemedText style={styles.copiedText}>Copied!</ThemedText>}
                    </View>

                    {/* Account Type */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Account Type:</ThemedText>
                        <ThemedText style={styles.infoValue}>{accountType}</ThemedText>
                    </View>

                    {/* Network(s) connected */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Network(s) connected:</ThemedText>
                        <View style={styles.networksList}>
                            {compatibleChains.length > 0 ? (
                                compatibleChains.map((chain, index) => (
                                    <View key={chain.id || index} style={styles.networkIconWrapper}>
                                        <Image
                                            source={chain.logoURI || chain.logo || ChainIcon}
                                            style={styles.fullSize}
                                            contentFit="contain"
                                        />
                                    </View>
                                ))
                            ) : (
                                isLoadingChains ? <ThemedText style={{ fontSize: 10, opacity: 0.5 }}>Loading...</ThemedText> :
                                    <View style={styles.networkIconWrapper}>
                                        <Image source={ChainIcon} style={styles.fullSize} contentFit="cover" />
                                    </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Action Buttons - Matching Figma: 8px gap, 54px height, rounded-full */}
                <View style={styles.actionsSection}>
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => {
                                router.push(action.route as any);
                            }}
                            style={styles.actionButton}
                        >
                            <View style={styles.actionIconWrapper}>
                                <Image
                                    source={action.icon}
                                    style={styles.fullSize}
                                    contentFit="contain"
                                />
                            </View>
                            <ThemedText style={styles.actionButtonText}>
                                {action.label}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* Receive Modal */}
            <Modal
                visible={showReceiveModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowReceiveModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowReceiveModal(false)}
                >
                    <ThemedView style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>Receive Funds</ThemedText>
                        <ThemedText style={styles.modalSubtitle}>Scan this QR code to receive assets</ThemedText>

                        <View style={styles.qrContainer}>
                            {address && (
                                <QRCode
                                    value={address}
                                    size={200}
                                    color="black"
                                    backgroundColor="white"
                                />
                            )}
                        </View>

                        <ThemedText style={styles.modalAddress}>{address}</ThemedText>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowReceiveModal(false)}
                        >
                            <ThemedText style={styles.closeButtonText}>Done</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </Pressable>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 68,
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        lineHeight: 20,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    infoSection: {
        width: '100%',
        // maxWidth: 400,
        gap: 20,
        marginBottom: 24,
    },
    infoGroup: {
        gap: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: colors.bodyText,
        fontFamily: 'Manrope-Medium',
    },
    infoValue: {
        fontSize: 16,
        color: colors.titleText,
        fontFamily: 'Manrope-Medium',
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    addressActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    smallActionIcon: {
        width: 20,
        height: 20,
    },
    iconContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copiedText: {
        fontSize: 12,
        color: colors.success,
        marginTop: 4,
    },
    networksList: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    networkIconWrapper: {
        width: 20.25,
        height: 20.25,
        borderRadius: 10.125,
        overflow: 'hidden',
    },
    actionsSection: {
        width: '100%',
        // maxWidth: 400,
        gap: 8,
    },
    actionButton: {
        width: '100%',
        height: 54,
        backgroundColor: colors.bgCards,
        borderRadius: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
    },
    actionIconWrapper: {
        width: 24,
        height: 24,
    },
    actionButtonText: {
        fontSize: 16,
        color: colors.titleText,
        fontFamily: 'Manrope-Regular',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1b1b1b',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        alignItems: 'center',
    },
    modalTitle: {
        fontFamily: 'Manrope-Bold',
        fontSize: 20,
        color: '#FFFFFF',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.mutedText,
        marginBottom: 32,
        textAlign: 'center',
    },
    qrContainer: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginBottom: 24,
    },
    modalAddress: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: '#FFFFFF',
        opacity: 0.6,
        marginBottom: 32,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    closeButton: {
        width: '100%',
        height: 54,
        backgroundColor: colors.primaryCTA,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 16,
        color: colors.bg,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
