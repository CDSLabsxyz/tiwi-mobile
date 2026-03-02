import { colors } from '@/constants/colors';
import { truncateAddress } from '@/utils/wallet';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useWalletStore } from '@/store/walletStore';

interface WalletModalProps {
    visible: boolean;
    onClose: () => void;
    walletAddress?: string;
    totalBalance?: string;
    onHistoryPress?: () => void;
    onSettingsPress?: () => void;
    onDisconnectPress?: () => void;
}

const TiwiCat = require('../../assets/home/tiwicat.svg');
const TiwiCatToken = require('../../assets/home/tiwicat-token.svg');
const TransactionHistory = require('../../assets/home/transaction-history.svg');
const SettingsIcon = require('../../assets/home/settings-03.svg');
const CopyIcon = require('../../assets/wallet/copy-01.svg');
const LogoutIcon = require('../../assets/wallet/logout-01.svg');
const TiwiLogo = require('../../assets/logo/tiwi-logo.svg');

type ModalMode = 'MAIN' | 'ADD_OPTIONS';

/**
 * Wallet Modal Component
 * Enhanced to support multi-wallet switching and "Add Wallet" flow
 */
export const WalletModal: React.FC<WalletModalProps> = (props) => {
    const {
        visible,
        onClose,
        walletAddress,
        totalBalance: initialBalance,
        onHistoryPress,
        onSettingsPress,
        onDisconnectPress,
    } = props;

    const router = useRouter();
    const {
        address: storeAddress,
        walletGroups = [],
        activeGroupId,
        setActiveGroup,
        removeWalletGroup,
        isConnected,
        _hasHydrated
    } = useWalletStore() || { _hasHydrated: false, walletGroups: [], address: '', activeGroupId: null, isConnected: false, removeWalletGroup: () => { } };

    if (!_hasHydrated) return null;

    // Safety: Ensure groups is always an array
    const safeGroups = Array.isArray(walletGroups) ? walletGroups : [];
    const activeGroup = safeGroups.find(g => g && g.id === activeGroupId);
    const walletIcon = activeGroup?.walletIcon;

    // 3. Balance Calculations
    const { data: balanceData, isLoading: isBalanceLoading } = useWalletBalances();
    const liveTotalBalance = balanceData?.totalNetWorthUsd ? `$${balanceData.totalNetWorthUsd}` : '$0.00';

    const activeAddress = walletAddress || storeAddress;
    const activeChain = activeGroup?.primaryChain;

    if (activeAddress) {
        console.log(`[WalletModal] Rendering with activeAddress: ${activeAddress}, Chain: ${activeChain}`);
    }

    const [mode, setMode] = useState<ModalMode>('MAIN');

    // Use provider icon if available and valid URI, otherwise fallback to TiwiCat
    const hasExternalIcon = typeof walletIcon === 'string' && walletIcon.trim().length > 0;

    // Use provided address or store address or fallback
    const fullAddress = walletAddress || storeAddress || '';
    const displayAddress = truncateAddress(fullAddress) || 'No address';

    // Final displayed balance
    const displayBalance = initialBalance || liveTotalBalance;
    const { bottom = 0 } = useSafeAreaInsets() || { bottom: 0 };
    const modalHeight = isConnected ? 600 : 400;
    const [copied, setCopied] = useState(false);

    const handleCopyAddress = async () => {
        if (!fullAddress) return;
        await Clipboard.setStringAsync(fullAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    const handleAddWallet = () => {
        setMode('ADD_OPTIONS');
    };

    const navigateToCreate = () => {
        if (onClose) onClose();
        router.push('/wallet/create' as any);
    };

    const navigateToImport = () => {
        if (onClose) onClose();
        router.push('/wallet/import' as any);
    };

    const renderMainView = () => {
        // Defensive check for missing wallet groups or state
        const isActuallyConnected = isConnected && safeGroups.length > 0;

        if (!isActuallyConnected) {
            return (
                <View style={styles.emptyStateContainer}>
                    <View style={styles.emptyLogoContainer}>
                        <ExpoImage source={TiwiLogo} style={{ width: 48, height: 48 }} contentFit="contain" />
                    </View>
                    <Text style={styles.emptyTitle}>No wallet connected</Text>
                    <Text style={styles.emptyText}>Add or create a wallet to start trading on Tiwi Protocol.</Text>

                    <TouchableOpacity
                        style={styles.addWalletButtonMain}
                        onPress={handleAddWallet}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={20} color={colors.bg} />
                        <Text style={styles.addWalletButtonTextMain}>Add Wallet</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.mainInfo}>
                {/* Wallet Avatar and Address */}
                <View style={[styles.userInfo, { minHeight: 100, width: '100%', marginTop: 10 }]}>
                    <View style={styles.avatarContainer}>
                        <ExpoImage source={TiwiLogo} style={styles.iconFull} contentFit="contain" />
                    </View>
                    <View style={styles.addressContainer}>
                        <Text style={[styles.addressText, { color: colors.titleText, fontSize: 18 }]}>
                            {displayAddress}
                        </Text>
                        <TouchableOpacity onPress={handleCopyAddress} style={[styles.copyButton, { width: 24, height: 24 }]}>
                            {copied ? (
                                <Text style={styles.checkMark}>✓</Text>
                            ) : (
                                <ExpoImage source={CopyIcon} style={{ width: 16, height: 16 }} contentFit="contain" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Cards Section */}
                <View style={styles.cardsSection}>
                    <TouchableOpacity
                        style={styles.balanceCard}
                        onPress={() => {
                            console.log('[WalletModal] Manual refresh triggered');
                            // Triggering a refresh via TanStack query is handled by the internal polling
                            // but we can log it to show we are responsive.
                        }}
                    >
                        <View style={styles.balanceHeader}>
                            <Text style={styles.cardLabel}>Total Balance</Text>
                            {isBalanceLoading && (
                                <View style={{ marginLeft: 8 }}>
                                    <ActivityIndicator size="small" color={colors.primaryCTA} />
                                </View>
                            )}
                            <TouchableOpacity onPress={() => setMode('ADD_OPTIONS')} style={styles.miniAddButton}>
                                <Ionicons name="add" size={16} color={colors.primaryCTA} />
                                <Text style={styles.miniAddText}>Add Wallet</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.balanceText, { color: isBalanceLoading ? '#6E7873' : colors.titleText }]}>
                            {isBalanceLoading && displayBalance === '$0.00' ? 'Updating...' : (displayBalance === '$0.00' && !isBalanceLoading ? '$0.00' : displayBalance)}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.actionCardsRow}>
                        <TouchableOpacity onPress={onHistoryPress} style={styles.actionCard} activeOpacity={0.7}>
                            <ExpoImage source={TransactionHistory} style={{ width: 20, height: 20, marginBottom: 8 }} contentFit="contain" />
                            <Text style={styles.cardLabel}>History</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onSettingsPress} style={[styles.actionCard, styles.actionCardLast]} activeOpacity={0.7}>
                            <ExpoImage source={SettingsIcon} style={{ width: 20, height: 20, marginBottom: 8 }} contentFit="contain" />
                            <Text style={styles.cardLabel}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Wallet Switcher List */}
                {safeGroups.length > 1 && (
                    <View style={styles.walletListSection}>
                        <Text style={styles.sectionTitle}>My Wallets</Text>
                        <ScrollView style={styles.walletScroll} showsVerticalScrollIndicator={false}>
                            {safeGroups.map((group) => {
                                if (!group) return null;
                                const isActive = group.id === activeGroupId;
                                const addr = group.addresses?.[group.primaryChain] || '';

                                return (
                                    <TouchableOpacity
                                        key={group.id}
                                        style={[styles.walletItem, isActive && styles.activeWalletItem]}
                                        onPress={() => setActiveGroup(group.id)}
                                    >
                                        <View style={styles.walletItemLeft}>
                                            <View style={styles.miniAvatar}>
                                                <ExpoImage source={TiwiCatToken} style={styles.iconFull} contentFit="contain" />
                                            </View>
                                            <View>
                                                <Text style={[styles.walletName, isActive && styles.activeWalletText]}>
                                                    {group.name || 'Unnamed Wallet'}
                                                </Text>
                                                <Text style={styles.walletAddr}>
                                                    {addr ? truncateAddress(addr, 6, 4) : 'No address'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.walletItemRight}>
                                            {isActive && <Ionicons name="checkmark-circle" size={20} color={colors.primaryCTA} style={{ marginRight: 8 }} />}
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    removeWalletGroup(group.id);
                                                }}
                                                style={styles.deleteWalletButton}
                                            >
                                                <Ionicons name="trash-outline" size={18} color={colors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                <TouchableOpacity onPress={onDisconnectPress} style={styles.disconnectButton} activeOpacity={0.8}>
                    <ExpoImage source={LogoutIcon} style={{ width: 20, height: 20 }} contentFit="contain" />
                    <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderAddOptionsView = () => (
        <View style={styles.optionsContainer}>
            <View style={styles.optionsHeader}>
                <TouchableOpacity onPress={() => setMode('MAIN')} style={styles.backButtonOption}>
                    <Ionicons name="chevron-back" size={24} color={colors.titleText} />
                </TouchableOpacity>
                <Text style={styles.optionsTitle}>Add Wallet</Text>
                <View style={{ width: 40 }} />
            </View>

            <TouchableOpacity style={styles.optionCard} onPress={navigateToCreate} activeOpacity={0.7}>
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(177, 241, 40, 0.1)' }]}>
                    <Ionicons name="wallet-outline" size={24} color={colors.primaryCTA} />
                </View>
                <View style={styles.optionTextContainer}>
                    <Text style={styles.optionLabel}>Create New Wallet</Text>
                    <Text style={styles.optionSubtext}>Generate a fresh 12-word seed phrase.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCard} onPress={navigateToImport} activeOpacity={0.7}>
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(63, 234, 155, 0.1)' }]}>
                    <Ionicons name="download-outline" size={24} color={colors.success} />
                </View>
                <View style={styles.optionTextContainer}>
                    <Text style={styles.optionLabel}>Import Existing Wallet</Text>
                    <Text style={styles.optionSubtext}>Use seed phrase or private key.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedText} />
            </TouchableOpacity>
        </View>
    );

    if (!visible) return null;

    try {
        return (
            <View style={[StyleSheet.absoluteFill, { zIndex: 999999, elevation: 999999 }]}>
                {/* 1. FULL SCREEN BACKDROP */}
                <Pressable
                    onPress={onClose}
                    style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}
                />

                {/* 2. MODAL CONTENT AREA */}
                <View
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        width: '100%',
                        maxHeight: '90%', // Don't cover status bar
                        height: modalHeight,
                        backgroundColor: colors.bgSemi,
                        borderTopLeftRadius: 32,
                        borderTopRightRadius: 32,
                        borderTopWidth: 1,
                        borderColor: colors.bgStroke,
                        zIndex: 1000001,
                        overflow: 'hidden'
                    }}
                >
                    <View style={styles.handleBarContainer}>
                        <View style={styles.handleBar} />
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            paddingHorizontal: 24,
                            paddingBottom: bottom + 40,
                            alignItems: 'center'
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        {mode === 'MAIN' ? renderMainView() : renderAddOptionsView()}
                    </ScrollView>
                </View>
            </View>
        );
    } catch (e) {
        console.error('WalletModal render error:', e);
        return null;
    }
};

const styles = StyleSheet.create({
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 9999
    },
    backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
    modalContent: {
        backgroundColor: colors.bgSemi,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderColor: colors.bgStroke,
    },
    innerContentWrapper: { width: '100%' },
    contentContainer: { alignItems: 'center', width: '100%' },
    handleBarContainer: { paddingVertical: 12, width: '100%', alignItems: 'center' },
    handleBar: { width: 40, height: 4, backgroundColor: colors.bgStroke, borderRadius: 100 },

    // Main View
    mainInfo: { width: '100%', paddingBottom: 10 },
    userInfo: { alignItems: 'center', marginBottom: 24 },
    avatarContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgCards, padding: 16, marginBottom: 12, justifyContent: 'center', alignItems: 'center' },
    avatar: { width: '100%', height: '100%' },
    addressContainer: { flexDirection: 'row', alignItems: 'center' },
    // text style fallbacks
    addressText: { fontSize: 18, color: colors.titleText, fontWeight: 'bold' },
    copyButton: { padding: 4, marginLeft: 8 },
    checkMark: { color: colors.primaryCTA, fontSize: 14 },
    iconFull: { width: '100%', height: '100%' },

    cardsSection: { width: '100%', marginBottom: 24 },
    balanceCard: { backgroundColor: colors.bgCards, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: colors.bgStroke, marginBottom: 12 },
    balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    miniAddButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(177, 241, 40, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    miniAddText: { color: colors.primaryCTA, fontSize: 12, fontWeight: '600', marginLeft: 4 },
    cardLabel: { fontSize: 14, color: colors.bodyText, marginBottom: 4 },
    balanceText: { fontSize: 24, color: colors.titleText, fontWeight: '900' },

    actionCardsRow: { flexDirection: 'row', width: '100%' },
    actionCard: { flex: 1, backgroundColor: colors.bgCards, borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.bgStroke, marginRight: 12 },
    actionCardLast: { marginRight: 0 },
    iconSmall: { width: 20, height: 20, marginBottom: 8 },

    // Wallet List
    walletListSection: { width: '100%', marginBottom: 24 },
    sectionTitle: { fontSize: 16, color: colors.titleText, fontWeight: '600', marginBottom: 12 },
    walletScroll: { width: '100%' },
    walletItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, padding: 12, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.bgStroke },
    activeWalletItem: { borderColor: colors.primaryCTA, backgroundColor: 'rgba(177, 241, 40, 0.05)' },
    walletItemLeft: { flexDirection: 'row', alignItems: 'center' },
    miniAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgCards, padding: 6, marginRight: 12 },
    walletName: { fontSize: 14, color: colors.titleText, fontWeight: '600' },
    activeWalletText: { color: colors.primaryCTA },
    walletAddr: { fontSize: 12, color: colors.mutedText },
    walletItemRight: { flexDirection: 'row', alignItems: 'center' },
    deleteWalletButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255, 92, 92, 0.05)' },

    disconnectButton: { width: "100%", backgroundColor: 'rgba(255, 92, 92, 0.1)', borderRadius: 28, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 92, 92, 0.3)' },
    disconnectText: { fontSize: 16, color: colors.error, fontWeight: 'bold', marginLeft: 8 },

    // Empty State
    emptyStateContainer: { width: '100%', alignItems: 'center', paddingVertical: 20 },
    emptyLogoContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bgCards, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    emptyLogo: { width: 48, height: 48 },
    emptyTitle: { fontSize: 20, color: colors.titleText, fontWeight: 'bold', marginBottom: 16 },
    emptyText: { fontSize: 14, color: colors.mutedText, textAlign: 'center', paddingHorizontal: 40, marginBottom: 16 },
    addWalletButtonMain: { backgroundColor: colors.primaryCTA, borderRadius: 28, height: 56, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    addWalletButtonTextMain: { fontSize: 16, color: colors.bg, fontWeight: 'bold', marginLeft: 8 },

    // Options View
    optionsContainer: { width: '100%', paddingBottom: 20 },
    optionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 24 },
    backButtonOption: { width: 40, height: 40, justifyContent: 'center' },
    optionsTitle: { fontSize: 20, color: colors.titleText, fontWeight: 'bold' },
    optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCards, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.bgStroke, marginBottom: 16 },
    optionIconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    optionTextContainer: { flex: 1 },
    optionLabel: { fontSize: 16, color: colors.titleText, fontWeight: 'bold', marginBottom: 2 },
    optionSubtext: { fontSize: 12, color: colors.mutedText },
});
