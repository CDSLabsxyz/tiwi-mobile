import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useWalletStore } from '@/store/walletStore';
import { truncateAddress } from '@/utils/wallet';
import { Ionicons } from '@expo/vector-icons';
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

const ALL_NETWORKS = [
    { id: 'ETH', name: 'Ethereum', chain: 'EVM', icon: require('@/assets/home/chains/ethereum.svg') },
    { id: 'BSC', name: 'BNB Chain', chain: 'EVM', icon: require('@/assets/home/chains/bsc.svg') },
    { id: 'POLYGON', name: 'Polygon', chain: 'EVM', icon: require('@/assets/home/chains/polygon.svg') },
    { id: 'BASE', name: 'Base', chain: 'EVM', icon: require('@/assets/home/chains/base.png') },
    { id: 'OPTIMISM', name: 'Optimism', chain: 'EVM', icon: require('@/assets/home/chains/optimism.png') },
    { id: 'AVALANCHE', name: 'Avalanche', chain: 'EVM', icon: require('@/assets/home/chains/avalanche.svg') },
    { id: 'SOLANA', name: 'Solana', chain: 'SOLANA', icon: require('@/assets/home/chains/solana.svg') },
    { id: 'TRON', name: 'Tron', chain: 'TRON', icon: require('@/assets/home/chains/tron.png') },
    { id: 'TON', name: 'TON', chain: 'TON', icon: require('@/assets/home/chains/ton.jpg') },
    { id: 'COSMOS', name: 'Cosmos', chain: 'COSMOS', icon: require('@/assets/home/chains/cosmos.svg') },
    { id: 'OSMOSIS', name: 'Osmosis', chain: 'OSMOSIS', icon: require('@/assets/home/chains/osmosis.svg') },
] as const;

export default function AccountSettingsScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const {
        activeAddress: address,
        activeGroupId,
        activeChain,
        name,
        walletGroups: connectedWallets = [],
        setActiveChain,
    } = useWalletStore();
    const [copied, setCopied] = useState(false);
    const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);

    // Find current wallet group
    const currentWallet = (connectedWallets || []).find(w =>
        w.id === activeGroupId ||
        Object.values(w.addresses || {}).some(addr => addr?.toLowerCase() === address?.toLowerCase())
    );
    const walletSource = currentWallet?.source || '';
    const isLocalWallet = walletSource === 'internal' || walletSource === 'imported' || walletSource === 'local';
    const isTiwiWallet = currentWallet?.type === 'mnemonic' || walletSource === 'internal';
    const accountType = isTiwiWallet ? 'TIWI Multichain Wallet' : 'External Wallet';

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

    const handleCopyAddress = async (addr?: string) => {
        const toCopy = addr || address;
        if (!toCopy) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await Clipboard.setStringAsync(toCopy);
            if (addr) {
                setCopiedAddr(addr);
                setTimeout(() => setCopiedAddr(null), 2000);
            } else {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (error) {
            console.error('Failed to copy address:', error);
        }
    };

    const handleReceivePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowReceiveModal(true);
    };

    const handleSwitchNetwork = (chain: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveChain(chain as any);
        setNetworkDropdownOpen(false);
    };

    const actions = [
        { label: 'Edit Wallet Name', icon: PencilEditIcon, route: '/settings/accounts/edit-wallet-name', visible: true },
        { label: 'Export Private Key', icon: CloudUploadIcon, route: '/settings/accounts/export-private-key', visible: isLocalWallet },
        { label: 'Export Recovery Phrase', icon: CloudUploadIcon, route: '/settings/accounts/export-recovery-phrase', visible: isLocalWallet && currentWallet?.source === 'local' },
        { label: 'Disconnect Wallet', icon: LogoutIcon, route: '/settings/accounts/disconnect-wallet', destructive: true, visible: true },
    ].filter(a => a.visible);

    const handleGoHome = () => {
        router.replace('/(tabs)');
    };

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity activeOpacity={0.7} onPress={handleBackPress} style={styles.backButton}>
                        <Image source={ChevronLeftIcon} style={styles.fullSize} contentFit="contain" />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>Account Settings</ThemedText>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: (bottom || 16) + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.infoSection}>
                    {/* Wallet Name */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Wallet Name:</ThemedText>
                        <ThemedText style={styles.infoValue}>{name || 'Wallet 1'}</ThemedText>
                    </View>

                    {/* Wallet Address with Network Dropdown */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Wallet Address:</ThemedText>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setNetworkDropdownOpen(!networkDropdownOpen)}
                            style={styles.addressDropdown}
                        >
                            <ThemedText style={styles.infoValue}>
                                {address ? truncateAddress(address) : 'No address'}
                            </ThemedText>
                            <View style={styles.addressActions}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={(e) => { e.stopPropagation(); handleCopyAddress(); }}
                                    style={styles.smallActionIcon}
                                >
                                    <View style={styles.iconContainer}>
                                        <Image source={CopyIcon} style={styles.fullSize} contentFit="contain" />
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={(e) => { e.stopPropagation(); handleReceivePress(); }}
                                    style={styles.smallActionIcon}
                                >
                                    <View style={styles.iconContainer}>
                                        <Image source={IrisScanIcon} style={styles.fullSize} contentFit="contain" />
                                    </View>
                                </TouchableOpacity>
                                <Ionicons
                                    name={networkDropdownOpen ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color="#888"
                                />
                            </View>
                        </TouchableOpacity>
                        {copied && <ThemedText style={styles.copiedText}>Copied!</ThemedText>}

                        {/* Network Dropdown */}
                        {networkDropdownOpen && currentWallet && (
                            <View style={styles.dropdownContainer}>
                                {ALL_NETWORKS.map((network) => {
                                    const chainAddress = currentWallet.addresses?.[network.chain as keyof typeof currentWallet.addresses] || '';
                                    const hasAddress = !!chainAddress;
                                    const isActive = activeChain === network.chain;
                                    const isCopied = copiedAddr === chainAddress;

                                    return (
                                        <TouchableOpacity
                                            key={network.id}
                                            style={[
                                                styles.networkItem,
                                                isActive && styles.networkItemActive,
                                                !hasAddress && styles.networkItemDisabled,
                                            ]}
                                            activeOpacity={0.7}
                                            onPress={() => hasAddress && handleSwitchNetwork(network.chain)}
                                            disabled={!hasAddress}
                                        >
                                            <View style={styles.networkItemLeft}>
                                                <View style={styles.networkIconWrapper}>
                                                    <Image
                                                        source={network.icon}
                                                        style={[styles.fullSize, !hasAddress && { opacity: 0.3 }]}
                                                        contentFit="contain"
                                                    />
                                                </View>
                                                <View style={styles.networkInfo}>
                                                    <ThemedText style={[styles.networkName, !hasAddress && { opacity: 0.3 }]}>
                                                        {network.name}
                                                    </ThemedText>
                                                    <ThemedText style={[styles.networkAddr, !hasAddress && { opacity: 0.3 }]}>
                                                        {hasAddress ? truncateAddress(chainAddress) : 'No address'}
                                                    </ThemedText>
                                                </View>
                                            </View>
                                            {hasAddress && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                    {isActive && <View style={styles.activeDot} />}
                                                    <TouchableOpacity
                                                        onPress={(e) => { e.stopPropagation(); handleCopyAddress(chainAddress); }}
                                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    >
                                                        <Ionicons
                                                            name={isCopied ? 'checkmark' : 'copy-outline'}
                                                            size={18}
                                                            color={isCopied ? colors.primaryCTA : '#666'}
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    {/* Account Type */}
                    <View style={styles.infoGroup}>
                        <ThemedText style={styles.infoLabel}>Account Type:</ThemedText>
                        <ThemedText style={styles.infoValue}>{accountType}</ThemedText>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsSection}>
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.7}
                            onPress={() => router.push(action.route as any)}
                            style={[styles.actionButton, action.destructive && styles.actionButtonDestructive]}
                        >
                            <View style={styles.actionIconWrapper}>
                                <Image source={action.icon} style={styles.fullSize} contentFit="contain" tintColor={action.destructive ? '#FF4D4D' : undefined} />
                            </View>
                            <ThemedText style={[styles.actionButtonText, action.destructive && { color: '#FF4D4D' }]}>{action.label}</ThemedText>
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleGoHome}
                        style={[styles.actionButton, { marginTop: 8 }]}
                    >
                        <Ionicons name="home-outline" size={20} color={colors.titleText} />
                        <ThemedText style={styles.actionButtonText}>Back to Home</ThemedText>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Receive Modal */}
            <Modal
                visible={showReceiveModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowReceiveModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowReceiveModal(false)}>
                    <ThemedView style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>Receive Funds</ThemedText>
                        <ThemedText style={styles.modalSubtitle}>Scan this QR code to receive assets</ThemedText>
                        <View style={styles.qrContainer}>
                            {address && <QRCode value={address} size={200} color="black" backgroundColor="white" />}
                        </View>
                        <ThemedText style={styles.modalAddress}>{address}</ThemedText>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setShowReceiveModal(false)}>
                            <ThemedText style={styles.closeButtonText}>Done</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </Pressable>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 68, paddingVertical: 10 },
    backButton: { width: 24, height: 24 },
    headerTitle: { fontFamily: 'Manrope-Medium', fontSize: 20, lineHeight: 20 },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 20, alignItems: 'center' },
    infoSection: { width: '100%', gap: 20, marginBottom: 24 },
    infoGroup: { gap: 8 },
    infoLabel: { fontSize: 14, color: colors.bodyText, fontFamily: 'Manrope-Medium' },
    infoValue: { fontSize: 16, color: colors.titleText, fontFamily: 'Manrope-Medium' },
    addressDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    addressActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    smallActionIcon: { width: 20, height: 20 },
    iconContainer: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    copiedText: { fontSize: 12, color: colors.success, marginTop: 4 },
    dropdownContainer: {
        backgroundColor: '#111810',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1F261E',
        overflow: 'hidden',
        marginTop: 8,
    },
    networkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1A2418',
    },
    networkItemActive: {
        backgroundColor: 'rgba(177, 241, 40, 0.06)',
    },
    networkItemDisabled: {
        opacity: 0.5,
    },
    networkItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    networkIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    networkInfo: { gap: 2, flex: 1 },
    networkName: { fontFamily: 'Manrope-SemiBold', fontSize: 14, color: '#FFFFFF' },
    networkAddr: { fontFamily: 'Manrope-Regular', fontSize: 12, color: '#888888' },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primaryCTA,
    },
    actionsSection: { width: '100%', gap: 8 },
    actionButton: {
        width: '100%', height: 54, backgroundColor: colors.bgCards,
        borderRadius: 100, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 8, padding: 10,
    },
    actionIconWrapper: { width: 24, height: 24 },
    actionButtonText: { fontSize: 16, color: colors.titleText, fontFamily: 'Manrope-Regular' },
    actionButtonDestructive: { borderWidth: 1, borderColor: 'rgba(255, 77, 77, 0.3)' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#1b1b1b', borderTopLeftRadius: 32,
        borderTopRightRadius: 32, padding: 32, alignItems: 'center',
    },
    modalTitle: { fontFamily: 'Manrope-Bold', fontSize: 20, color: '#FFFFFF', marginBottom: 8 },
    modalSubtitle: { fontFamily: 'Manrope-Regular', fontSize: 14, color: colors.mutedText, marginBottom: 32, textAlign: 'center' },
    qrContainer: { padding: 20, backgroundColor: '#FFFFFF', borderRadius: 24, marginBottom: 24 },
    modalAddress: {
        fontFamily: 'Manrope-Medium', fontSize: 14, color: '#FFFFFF',
        opacity: 0.6, marginBottom: 32, textAlign: 'center', paddingHorizontal: 20,
    },
    closeButton: {
        width: '100%', height: 54, backgroundColor: colors.primaryCTA,
        borderRadius: 100, alignItems: 'center', justifyContent: 'center',
    },
    closeButtonText: { fontFamily: 'Manrope-Bold', fontSize: 16, color: colors.bg },
    fullSize: { width: '100%', height: '100%' },
});
