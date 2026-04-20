import { colors } from '@/constants/colors';
import { truncateAddress } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useCustomTokenStore } from '@/store/customTokenStore';
import { useWalletStore } from '@/store/walletStore';

interface WalletModalProps {
    visible: boolean;
    onClose: () => void;
    walletAddress?: string;
    totalBalance?: string;
    onReferralPress?: () => void;
    onSettingsPress?: () => void;
    onDisconnectPress?: () => void;
}

const TiwiCat = require('../../assets/home/tiwicat.svg');
const TiwiCatToken = require('../../assets/home/tiwicat-token.svg');
const ReferralIcon = require('../../assets/settings/user-group-02.svg');
const SettingsIcon = require('../../assets/home/settings-03.svg');
const CopyIcon = require('../../assets/wallet/copy-01.svg');
const LogoutIcon = require('../../assets/wallet/logout-01.svg');
const TiwiLogo = require('../../assets/logo/tiwi-logo.svg');
const PlusIcon = require('../../assets/settings/add-square.svg');
const SearchIcon = require('../../assets/swap/search-01.svg');
const ChevronDownIcon = require('../../assets/home/arrow-down-01.svg');
const ChevronUpIcon = require('../../assets/swap/arrow-up-02.svg');
const ChevronRightIcon = require('../../assets/home/arrow-right-01.svg');
const ChevronLeftIcon = require('../../assets/swap/arrow-left-02.svg');
const CheckmarkCircleIcon = require('../../assets/swap/checkmark-circle-01.svg');
const TrashIcon = require('../../assets/settings/delete-02.svg');
const EyeIcon = require('../../assets/home/view.svg');
const EyeOffIcon = require('../../assets/settings/unavailable.svg');
const WalletOutlineIcon = require('../../assets/home/wallet-03.svg');
const DownloadIcon = require('../../assets/home/download-04.svg');

type ModalMode = 'MAIN' | 'ADD_OPTIONS';
const ALL_NETWORKS = [
    { id: 'ETH', name: 'Ethereum', chain: 'EVM', icon: require('../../assets/home/chains/ethereum.svg') },
    { id: 'BSC', name: 'BNB Chain', chain: 'EVM', icon: require('../../assets/home/chains/bsc.svg') },
    { id: 'POLYGON', name: 'Polygon', chain: 'EVM', icon: require('../../assets/home/chains/polygon.svg') },
    { id: 'BASE', name: 'Base', chain: 'EVM', icon: require('../../assets/home/chains/base.png') },
    { id: 'OPTIMISM', name: 'Optimism', chain: 'EVM', icon: require('../../assets/home/chains/optimism.png') },
    { id: 'AVALANCHE', name: 'Avalanche', chain: 'EVM', icon: require('../../assets/home/chains/avalanche.svg') },
    { id: 'SOLANA', name: 'Solana', chain: 'SOLANA', icon: require('../../assets/home/chains/solana.svg') },
    { id: 'TRON', name: 'Tron', chain: 'TRON', icon: require('../../assets/home/chains/tron.png') },
    { id: 'TON', name: 'TON', chain: 'TON', icon: require('../../assets/home/chains/ton.jpg') },
    { id: 'COSMOS', name: 'Cosmos', chain: 'COSMOS', icon: require('../../assets/home/chains/cosmos.svg') },
    { id: 'OSMOSIS', name: 'Osmosis', chain: 'OSMOSIS', icon: require('../../assets/home/chains/osmosis.svg') },
] as const;

const ChainIcons = {
    EVM: require('../../assets/home/chains/ethereum.svg'),
    SOLANA: require('../../assets/home/chains/solana.svg'),
    TRON: require('../../assets/home/chains/tron.png'),
    TON: require('../../assets/home/chains/ton.jpg'),
    COSMOS: require('../../assets/home/chains/cosmos.svg'),
    OSMOSIS: require('../../assets/home/chains/osmosis.svg'),
};

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
        onReferralPress,
        onSettingsPress,
        onDisconnectPress,
    } = props;

    const router = useRouter();
    const { bottom = 0 } = useSafeAreaInsets() || { bottom: 0 };

    // 1. Store hooks (Using narrow selectors for performance)
    const walletGroups = useWalletStore(s => s.walletGroups ?? []);
    const activeGroupId = useWalletStore(s => s.activeGroupId);
    const activeChain = useWalletStore(s => s.activeChain);
    const setActiveGroup = useWalletStore(s => s.setActiveGroup);
    const setActiveChain = useWalletStore(s => s.setActiveChain);
    const removeWalletGroup = useWalletStore(s => s.removeWalletGroup);
    const isConnected = useWalletStore(s => s.isConnected);
    const isBalanceHidden = useWalletStore(s => s.isBalanceHidden);
    const toggleBalanceVisibility = useWalletStore(s => s.toggleBalanceVisibility);
    const _hasHydrated = useWalletStore(s => s._hasHydrated);
    const syncActiveGroupAddresses = useWalletStore(s => s.syncActiveGroupAddresses);
    const storeAddress = useWalletStore(s => s.address);

    // 2. Data and State hooks
    const {
        data: balanceData,
        isFetching: isBalanceFetching,
        isPlaceholderData: isBalancePlaceholder,
    } = useWalletBalances();

    // True only on fresh import (no data yet) or wallet switch (showing
    // previous wallet's data while the new one fetches). Background
    // refetches of the same wallet are intentionally excluded so the
    // balance doesn't flicker every minute.
    const isBalanceUpdating =
        isBalanceFetching && (isBalancePlaceholder || !balanceData);
    const [mode, setMode] = useState<ModalMode>('MAIN');
    const [copied, setCopied] = useState(false);
    const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isWalletListExpanded, setIsWalletListExpanded] = useState(false);

    // 3. Animation hooks
    const translateY = useSharedValue(0);
    const context = useSharedValue({ y: 0 });

    const closeModal = useCallback(() => {
        'worklet';
        runOnJS(onClose)();
    }, [onClose]);

    // Use a fixed modal height for consistent interpolation
    const modalHeight = isConnected ? 680 : 400;

    // 4. Visibility Control
    const [renderModal, setRenderModal] = useState(visible);

    React.useEffect(() => {
        if (visible) {
            setRenderModal(true);
            translateY.value = 0;
            if (activeGroupId && syncActiveGroupAddresses) {
                syncActiveGroupAddresses();
            }
        } else {
            // Dismiss animation
            translateY.value = withTiming(modalHeight, { duration: 250 }, () => {
                runOnJS(setRenderModal)(false);
            });
        }
    }, [visible, activeGroupId, syncActiveGroupAddresses, modalHeight]);

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, event.translationY + context.value.y);
        })
        .onEnd((event) => {
            if (translateY.value > modalHeight / 4 || event.velocityY > 500) {
                translateY.value = withTiming(modalHeight, { duration: 200 }, () => {
                    closeModal();
                });
            } else {
                translateY.value = withSpring(0, {
                    damping: 25,
                    stiffness: 200,
                    mass: 0.8
                });
            }
        })
        .activeOffsetY(5)
        .failOffsetY(-5);

    const animatedModalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateY.value,
            [0, modalHeight],
            [1, 0],
            'clamp'
        ),
    }));

    // Recompute the headline total from only the non-hidden tokens so the
    // value stays in sync with whatever the user toggled on/off in Manage
    // Tokens. Falls back to the API total when nothing is hidden. These
    // hooks must run on every render (before any early return) to satisfy
    // the rules of hooks.
    const walletKey = activeGroupId || storeAddress || 'default';
    const hiddenWalletTokens = useCustomTokenStore(s => s.hiddenWalletTokens);
    const customTokensByWallet = useCustomTokenStore(s => s.tokensByWallet);
    const hiddenKeySet = React.useMemo(() => {
        const set = new Set<string>();
        (hiddenWalletTokens[walletKey] || []).forEach(r => {
            set.add(`${r.chainId}-${r.address.toLowerCase()}`);
        });
        (customTokensByWallet[walletKey] || []).forEach(ct => {
            if (ct.hidden) set.add(`${ct.chainId}-${ct.address.toLowerCase()}`);
        });
        return set;
    }, [hiddenWalletTokens, customTokensByWallet, walletKey]);

    const liveTotalBalance = React.useMemo(() => {
        if (!balanceData) return '$0.00';
        if (hiddenKeySet.size === 0) {
            return balanceData.totalNetWorthUsd ? `$${balanceData.totalNetWorthUsd}` : '$0.00';
        }
        const sum = (balanceData.tokens || []).reduce((acc: number, t: any) => {
            const k = `${Number(t.chainId)}-${(t.address || '').toLowerCase()}`;
            if (hiddenKeySet.has(k)) return acc;
            const v = parseFloat(t.usdValue || '0');
            return acc + (isFinite(v) ? v : 0);
        }, 0);
        return `$${sum.toFixed(2)}`;
    }, [balanceData, hiddenKeySet]);

    // EARLY RENDERING CHECK
    if (!_hasHydrated || (!renderModal && !visible)) return null;

    // Safety: Ensure groups is always an array
    const safeGroups = Array.isArray(walletGroups) ? walletGroups : [];
    const activeGroup = safeGroups.find(g => g && g.id === activeGroupId);
    const walletIcon = activeGroup?.walletIcon;

    const activeAddress = walletAddress || storeAddress;

    if (activeAddress) {
        console.log(`[WalletModal] Rendering with activeAddress: ${activeAddress}, Chain: ${activeChain}`);
    }

    // Use provider icon if available and valid URI, otherwise fallback to TiwiCat
    const hasExternalIcon = typeof walletIcon === 'string' && walletIcon.trim().length > 0;

    // Use provided address or store address or fallback
    const fullAddress = walletAddress || storeAddress || '';
    const displayAddress = truncateAddress(fullAddress) || 'No address';

    // Final displayed balance
    const displayBalance = initialBalance || liveTotalBalance;


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
                        <ExpoImage source={PlusIcon} style={{ width: 20, height: 20 }} tintColor={colors.bg} contentFit="contain" />
                        <Text style={styles.addWalletButtonTextMain}>Add Wallet</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.mainInfo}>
                {/* 1. Top Card Identity Trigger */}
                <TouchableOpacity 
                    style={styles.identityCard} 
                    activeOpacity={0.9}
                    onPress={() => setIsExpanded(!isExpanded)}
                >
                    <View style={styles.identityLeft}>
                        <View style={styles.identityIconContainer}>
                            <ExpoImage source={TiwiLogo} style={styles.iconFull} contentFit="contain" />
                        </View>
                        <View style={styles.identityTextContainer}>
                            <Text style={styles.identityChainLabel}>
                                {activeChain === 'EVM' ? 'ETHEREUM' : activeChain}
                            </Text>
                            <Text style={styles.identityAddressText}>{displayAddress}</Text>
                        </View>
                    </View>
                    <View style={styles.identityRight}>
                         <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleCopyAddress(); }} style={styles.identityCopyButton}>
                             {copied ? <Text style={styles.checkMark}>✓</Text> : <ExpoImage source={CopyIcon} style={{ width: 18, height: 18, opacity: 0.6 }} contentFit="contain" />}
                        </TouchableOpacity>
                        <ExpoImage source={isExpanded ? ChevronUpIcon : ChevronDownIcon} style={{ width: 20, height: 20 }} tintColor={colors.mutedText} contentFit="contain" />
                    </View>
                </TouchableOpacity>

                {/* 2. Expanded Content: Search & Network List */}
                {isExpanded && (
                    <View style={{ width: '100%', flex: 1 }}>
                        <View style={styles.searchContainer}>
                            <View style={styles.searchInputWrapper}>
                                <ExpoImage source={SearchIcon} style={{ width: 20, height: 20 }} tintColor={colors.mutedText} contentFit="contain" />
                                <Text style={styles.searchPlaceholder}>Search network</Text>
                            </View>
                        </View>

                        <View style={styles.chainSwitcherListContainer}>
                            <Text style={styles.sectionLabel}>TRENDING NETWORKS</Text>
                            <ScrollView showsVerticalScrollIndicator={false} style={styles.chainListScroll} nestedScrollEnabled>
                                {ALL_NETWORKS.map((network) => {
                                    const isChainActive = selectedNetworkId === network.id;
                                    const hasAddress = activeGroup?.addresses?.[network.chain];
                                    const chainAddress = activeGroup?.addresses?.[network.chain] || '';
                                    const displayChainAddress = truncateAddress(chainAddress);

                                    return (
                                        <TouchableOpacity
                                            key={network.id}
                                            activeOpacity={0.7}
                                            style={[
                                                styles.chainListItem,
                                                isChainActive && styles.activeChainListItem,
                                                !hasAddress && styles.disabledChainListItem
                                            ]}
                                            onPress={() => {
                                                if (!hasAddress) return;
                                                setSelectedNetworkId(network.id);
                                                setActiveChain(network.chain as any, network.id);
                                            }}
                                            disabled={!hasAddress}
                                        >
                                            <View style={styles.chainRowLeft}>
                                                <View style={styles.chainListIconContainer}>
                                                    <ExpoImage 
                                                        source={network.icon} 
                                                        style={[styles.chainListIcon, !hasAddress && { opacity: 0.3 }]} 
                                                        contentFit="contain" 
                                                    />
                                                </View>
                                                <View style={styles.chainNameContainer}>
                                                    <Text style={styles.chainNameText}>{network.name}</Text>
                                                    <Text style={styles.chainAddressText}>{displayChainAddress || 'No address'}</Text>
                                                </View>
                                            </View>
                                            {hasAddress && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                    {isChainActive && <View style={styles.onlineDot} />}
                                                    <TouchableOpacity 
                                                        onPress={() => {
                                                            if (chainAddress) {
                                                                Clipboard.setStringAsync(chainAddress);
                                                                setCopied(true);
                                                                setTimeout(() => setCopied(false), 2000);
                                                            }
                                                        }}
                                                        style={styles.copyRowButton}
                                                    >
                                                        <ExpoImage source={CopyIcon} style={{ width: 18, height: 18, opacity: 0.5 }} contentFit="contain" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                )}

                {/* 3. Multi-Wallet Toggle */}
                {!isExpanded && safeGroups.length > 1 && (
                    <TouchableOpacity 
                        onPress={() => setIsWalletListExpanded(!isWalletListExpanded)}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, marginBottom: 16 }}
                        activeOpacity={0.7}
                    >
                        <Text style={{ fontSize: 13, color: colors.mutedText, fontFamily: 'Manrope-SemiBold' }}>
                             {isWalletListExpanded ? "Hide Wallets" : "Switch Wallet"}
                        </Text>
                        <ExpoImage source={isWalletListExpanded ? ChevronUpIcon : ChevronDownIcon} style={{ width: 14, height: 14 }} tintColor={colors.mutedText} contentFit="contain" />
                    </TouchableOpacity>
                )}

                {/* Expanded Wallet List (Dropdown Style) */}
                {isWalletListExpanded && !isExpanded && (
                    <View style={styles.walletDropdownContainer}>
                        {safeGroups.map((group) => {
                             if (!group) return null;
                             const isActive = group.id === activeGroupId;
                             // Always show the wallet's own EVM address in the list (or its primary chain if no EVM),
                             // regardless of the currently-selected chain. Otherwise switching to COSMOS/TON/SOL
                             // would make every wallet display its address for that chain.
                             const primaryAddr = group.addresses?.EVM || group.addresses?.[group.primaryChain] || '';
                             
                             return (
                                <TouchableOpacity 
                                    key={group.id} 
                                    style={[styles.walletDropdownItem, isActive && styles.activeWalletDropdownItem]}
                                    onPress={() => {
                                        setActiveGroup(group.id);
                                        // Auto-collapse after switch? User might prefer it open to see result.
                                    }}
                                >
                                    <View style={styles.walletItemLeft}>
                                        <View style={styles.miniAvatar}>
                                            <ExpoImage source={TiwiLogo} style={styles.iconFull} contentFit="contain" />
                                        </View>
                                        <View>
                                            <Text style={[styles.walletName, isActive && styles.activeWalletText]}>
                                                {group.name || 'Unnamed Wallet'}
                                            </Text>
                                            <Text style={styles.walletAddr}>
                                                {primaryAddr ? truncateAddress(primaryAddr, 6, 4) : 'No address'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.walletItemRight}>
                                        {isActive && <ExpoImage source={CheckmarkCircleIcon} style={{ width: 18, height: 18 }} tintColor={colors.primaryCTA} contentFit="contain" />}
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                removeWalletGroup(group.id);
                                            }}
                                            style={[styles.deleteWalletButton, { marginLeft: 12 }]}
                                        >
                                            <ExpoImage source={TrashIcon} style={{ width: 16, height: 16 }} tintColor={colors.error} contentFit="contain" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                             );
                        })}
                        <TouchableOpacity style={styles.addWalletDropdownItem} onPress={handleAddWallet}>
                            <ExpoImage source={PlusIcon} style={{ width: 18, height: 18 }} tintColor={colors.primaryCTA} contentFit="contain" />
                            <Text style={styles.addWalletDropdownText}>Import or Create New Wallet</Text>
                        </TouchableOpacity>
                    </View>
                )}
                
                {/* Cards Section - Hide when viewing networks for focus */}
                {!isExpanded && (
                    <View style={styles.cardsSection}>
                        <TouchableOpacity
                            style={styles.balanceCard}
                            onPress={() => {
                                console.log('[WalletModal] Manual refresh triggered');
                            }}
                        >
                            <View style={styles.balanceHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={styles.cardLabel}>Total Balance</Text>
                                    <TouchableOpacity onPress={toggleBalanceVisibility}>
                                        <ExpoImage
                                            source={isBalanceHidden ? EyeOffIcon : EyeIcon}
                                            style={{ width: 16, height: 16 }}
                                            tintColor={colors.mutedText}
                                            contentFit="contain"
                                        />
                                    </TouchableOpacity>
                                </View>
                                {isBalanceUpdating && (
                                    <View style={{ marginLeft: 8 }}>
                                        <ActivityIndicator size="small" color={colors.primaryCTA} />
                                    </View>
                                )}
                                <TouchableOpacity onPress={() => setMode('ADD_OPTIONS')} style={styles.miniAddButton}>
                                    <ExpoImage source={PlusIcon} style={{ width: 16, height: 16 }} tintColor={colors.primaryCTA} contentFit="contain" />
                                    <Text style={styles.miniAddText}>Add Wallet</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.balanceText, { color: isBalanceUpdating ? '#6E7873' : colors.titleText }]}>
                                {isBalanceHidden
                                    ? '****'
                                    : (isBalanceUpdating ? 'Updating…' : displayBalance)}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.actionCardsRow}>
                            <TouchableOpacity onPress={onReferralPress} style={styles.actionCard} activeOpacity={0.7}>
                                <ExpoImage source={ReferralIcon} style={{ width: 20, height: 20, marginBottom: 8 }} contentFit="contain" />
                                <Text style={styles.cardLabel}>Referrals</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onSettingsPress} style={[styles.actionCard, styles.actionCardLast]} activeOpacity={0.7}>
                                <ExpoImage source={SettingsIcon} style={{ width: 20, height: 20, marginBottom: 8 }} contentFit="contain" />
                                <Text style={styles.cardLabel}>Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!isExpanded && (
                    <TouchableOpacity onPress={onDisconnectPress} style={styles.disconnectButton} activeOpacity={0.8}>
                        <ExpoImage source={LogoutIcon} style={{ width: 20, height: 20 }} contentFit="contain" />
                        <Text style={styles.disconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderAddOptionsView = () => (
        <View style={styles.optionsContainer}>
            <View style={styles.optionsHeader}>
                <TouchableOpacity onPress={() => setMode('MAIN')} style={styles.backButtonOption}>
                    <ExpoImage source={ChevronLeftIcon} style={{ width: 24, height: 24 }} tintColor={colors.titleText} contentFit="contain" />
                </TouchableOpacity>
                <Text style={styles.optionsTitle}>Add Wallet</Text>
                <View style={{ width: 40 }} />
            </View>

            <TouchableOpacity style={styles.optionCard} onPress={navigateToCreate} activeOpacity={0.7}>
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(177, 241, 40, 0.1)' }]}>
                    <ExpoImage source={WalletOutlineIcon} style={{ width: 24, height: 24 }} tintColor={colors.primaryCTA} contentFit="contain" />
                </View>
                <View style={styles.optionTextContainer}>
                    <Text style={styles.optionLabel}>Create New Wallet</Text>
                    <Text style={styles.optionSubtext}>Generate a fresh 12-word seed phrase.</Text>
                </View>
                <ExpoImage source={ChevronRightIcon} style={{ width: 20, height: 20 }} tintColor={colors.mutedText} contentFit="contain" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCard} onPress={navigateToImport} activeOpacity={0.7}>
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(63, 234, 155, 0.1)' }]}>
                    <ExpoImage source={DownloadIcon} style={{ width: 24, height: 24 }} tintColor={colors.success} contentFit="contain" />
                </View>
                <View style={styles.optionTextContainer}>
                    <Text style={styles.optionLabel}>Import Existing Wallet</Text>
                    <Text style={styles.optionSubtext}>Use seed phrase or private key.</Text>
                </View>
                <ExpoImage source={ChevronRightIcon} style={{ width: 20, height: 20 }} tintColor={colors.mutedText} contentFit="contain" />
            </TouchableOpacity>
        </View>
    );



    try {
        return (
            <View style={[StyleSheet.absoluteFill, { zIndex: 999999, elevation: 999999 }]}>
                {/* 1. FULL SCREEN BACKDROP */}
                <Animated.View style={[StyleSheet.absoluteFill, animatedBackdropStyle]}>
                    <Pressable
                        onPress={onClose}
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]}
                    />
                </Animated.View>

                {/* 2. MODAL CONTENT AREA */}
                <GestureDetector gesture={gesture}>
                    <Animated.View
                        style={[{
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
                        }, animatedModalStyle]}
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
                    </Animated.View>
                </GestureDetector>
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

    // Identity Card Dropdown
    identityCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: colors.bgCards, 
        borderRadius: 24, 
        padding: 16, 
        width: '100%',
        marginTop: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.bgStroke
    },
    identityLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    identityIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000', padding: 8, alignItems: 'center', justifyContent: 'center' },
    identityTextContainer: { gap: 2 },
    identityChainLabel: { fontSize: 10, fontFamily: 'Manrope-Bold', color: colors.mutedText, letterSpacing: 0.5 },
    identityAddressText: { fontSize: 16, fontFamily: 'Manrope-SemiBold', color: colors.titleText },
    identityRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    identityCopyButton: { padding: 4 },

    walletDropdownContainer: { 
        backgroundColor: colors.bgCards, 
        borderRadius: 20, 
        padding: 8, 
        width: '100%', 
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        marginTop: 4
    },
    walletDropdownItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: 12, 
        borderRadius: 12,
        marginBottom: 4
    },
    activeWalletDropdownItem: { backgroundColor: 'rgba(255,255,255,0.05)' },
    addWalletDropdownItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12, 
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: colors.bgStroke,
        marginTop: 4
    },
    addWalletDropdownText: { fontSize: 14, fontFamily: 'Manrope-SemiBold', color: colors.primaryCTA },

    // Search Bar
    mainInfo: { width: '100%', paddingBottom: 10 },
    iconFull: { width: '100%', height: '100%' },
    checkMark: { color: colors.primaryCTA, fontSize: 14 },

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
    walletItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    miniAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgCards, padding: 6 },
    walletName: { fontSize: 14, color: colors.titleText, fontFamily: 'Manrope-SemiBold' },
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
    
    // Search Bar
    searchContainer: { width: '100%', paddingHorizontal: 4, marginBottom: 12 },
    searchInputWrapper: { 
        height: 48, 
        backgroundColor: colors.bgCards, 
        borderRadius: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        gap: 12,
        borderWidth: 1,
        borderColor: colors.bgStroke
    },
    searchPlaceholder: { color: colors.mutedText, fontSize: 16, fontFamily: 'Manrope-Medium' },

    // Chain Switcher List
    chainSwitcherListContainer: { width: '100%', paddingHorizontal: 4, flex: 1 },
    sectionLabel: { 
        fontSize: 10, 
        fontFamily: 'Manrope-Bold', 
        color: colors.mutedText, 
        letterSpacing: 1, 
        marginBottom: 12,
        marginLeft: 4,
        marginTop: 8
    },
    chainListScroll: { width: '100%' },
    chainListItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingVertical: 12, 
        paddingHorizontal: 16, 
        borderRadius: 16,
        marginBottom: 4,
        width: '100%'
    },
    activeChainListItem: { 
        backgroundColor: colors.bgCards,
        borderWidth: 1,
        borderColor: colors.bgStroke
    },
    disabledChainListItem: { opacity: 0.3 },
    chainRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    chainListIconContainer: { 
        width: 40, 
        height: 40, 
        borderRadius: 20, 
        backgroundColor: colors.bgCards, 
        alignItems: 'center', 
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.bgStroke
    },
    chainListIcon: { width: 24, height: 24, borderRadius: 12 },
    chainNameContainer: { gap: 2 },
    chainNameText: { fontSize: 16, fontFamily: 'Manrope-SemiBold', color: colors.titleText },
    chainAddressText: { fontSize: 12, fontFamily: 'Manrope-Medium', color: colors.mutedText },
    copyRowButton: { padding: 8 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B1F128' },
});
