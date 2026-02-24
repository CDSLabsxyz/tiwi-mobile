import { colors } from '@/constants/colors';
import { truncateAddress } from '@/utils/wallet';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
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
const TransactionHistory = require('../../assets/home/transaction-history.svg');
const Settings = require('../../assets/home/settings-03.svg');
const CopyIcon = require('../../assets/wallet/copy-01.svg');
const LogoutIcon = require('../../assets/wallet/logout-01.svg');

/**
 * Wallet Modal Component
 * Slides up from bottom with animation
 * Matches Figma design exactly
 * Dimensions: 393px × 441px
 */
export const WalletModal: React.FC<WalletModalProps> = ({
    visible,
    onClose,
    walletAddress,
    totalBalance: initialBalance,
    onHistoryPress,
    onSettingsPress,
    onDisconnectPress,
}) => {
    const { address: storeAddress, walletIcon } = useWalletStore();
    const { data: balanceData } = useWalletBalances();
    const totalNetWorthUsd = balanceData?.totalNetWorthUsd || '0.00';

    // Use provider icon if available, otherwise fallback to TiwiCat
    const displayIcon = walletIcon ? { uri: walletIcon } : TiwiCat;

    // Use provided address or store address or fallback
    const fullAddress = walletAddress || storeAddress || '';
    const displayAddress = truncateAddress(fullAddress);

    const [totalBalance, setTotalBalance] = useState(initialBalance || `$${totalNetWorthUsd}`);
    const { bottom } = useSafeAreaInsets();

    // Modal height from Figma: 441px
    const modalHeight = 480;
    const translateY = useSharedValue(modalHeight); // Start off-screen
    const opacity = useSharedValue(0);
    const [copied, setCopied] = useState(false);

    // Sync total balance from hook if not provided as prop
    useEffect(() => {
        if (!initialBalance) {
            setTotalBalance(`$${totalNetWorthUsd}`);
        }
    }, [totalNetWorthUsd, initialBalance]);

    useEffect(() => {
        if (visible) {
            // Slide up animation - Smooth entry with cubic easing
            translateY.value = withTiming(0, {
                duration: 400,
                easing: Easing.out(Easing.cubic),
            });
            opacity.value = withTiming(1, { duration: 400 });
        } else {
            // Slide down animation
            translateY.value = withTiming(modalHeight, { duration: 300, easing: Easing.in(Easing.cubic) });
            opacity.value = withTiming(0, { duration: 300 });
        }
    }, [visible, modalHeight, opacity, translateY]);

    const modalStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    const backdropStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
        };
    });

    const handleBackdropPress = () => {
        onClose();
    };

    const handleCopyAddress = async () => {
        // Copy the full address, not the truncated one
        await Clipboard.setStringAsync(fullAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    const context = useSharedValue({ y: 0 });
    const panGesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, context.value.y + event.translationY);
        })
        .onEnd((event) => {
            if (event.translationY > 100) {
                runOnJS(onClose)();
            } else {
                translateY.value = withTiming(0, {
                    duration: 300,
                    easing: Easing.out(Easing.cubic),
                });
            }
        });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.modalOverlay}>
                    {/* Backdrop */}
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={handleBackdropPress}
                    >
                        <Animated.View
                            style={[
                                styles.backdrop,
                                backdropStyle,
                            ]}
                        />
                    </Pressable>

                    {/* Modal Content */}
                    <GestureDetector gesture={panGesture}>
                        <Animated.View
                            style={[
                                styles.modalContent,
                                { paddingBottom: bottom || 24, height: modalHeight },
                                modalStyle,
                            ]}
                        >
                            <Pressable onPress={(e) => e.stopPropagation()} style={styles.innerContentWrapper}>
                                <View style={[styles.contentContainer, ]}>
                                    {/* Top Handle Bar */}
                                    <View style={styles.handleBarContainer}>
                                        <View style={styles.handleBar} />
                                    </View>

                                    {/* Main Content */}
                                    <View style={styles.mainInfo}>
                                        {/* Wallet Avatar and Address */}
                                        <View style={styles.userInfo}>
                                            {/* Tiwicat Avatar */}
                                            <View style={styles.avatarContainer}>
                                                <Image
                                                    source={displayIcon}
                                                    style={styles.avatar}
                                                    contentFit="cover"
                                                />
                                            </View>

                                            {/* Wallet Address with Copy */}
                                            <View style={styles.addressContainer}>
                                                <Text style={styles.addressText}>
                                                    {displayAddress}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={handleCopyAddress}
                                                    style={styles.copyButton}
                                                >
                                                    {copied ? (
                                                        <Text style={styles.checkMark}>✓</Text>
                                                    ) : (
                                                        <Image
                                                            source={CopyIcon}
                                                            style={styles.iconFull}
                                                            contentFit="contain"
                                                        />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Cards Section */}
                                        <View style={styles.cardsSection}>
                                            {/* Total Balance Card */}
                                            <View style={styles.balanceCard}>
                                                <Text style={styles.cardLabel}>Total Balance</Text>
                                                <Text style={styles.balanceText}>{totalBalance}</Text>
                                            </View>

                                            {/* History and Settings Cards */}
                                            <View style={styles.actionCardsRow}>
                                                {/* History Card */}
                                                <TouchableOpacity
                                                    onPress={onHistoryPress}
                                                    style={styles.actionCard}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.iconSmall}>
                                                        <Image
                                                            source={TransactionHistory}
                                                            style={styles.iconFull}
                                                            contentFit="contain"
                                                        />
                                                    </View>
                                                    <Text style={styles.cardLabel}>History</Text>
                                                </TouchableOpacity>

                                                {/* Settings Card */}
                                                <TouchableOpacity
                                                    onPress={onSettingsPress}
                                                    style={styles.actionCard}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.iconSmall}>
                                                        <Image
                                                            source={Settings}
                                                            style={styles.iconFull}
                                                            contentFit="contain"
                                                        />
                                                    </View>
                                                    <Text style={styles.cardLabel}>Settings</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Disconnect Button */}
                                    <TouchableOpacity
                                        onPress={onDisconnectPress}
                                        style={[styles.disconnectButton]}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.iconSmall}>
                                            <Image
                                                source={LogoutIcon}
                                                style={styles.iconFull}
                                                contentFit="contain"
                                            />
                                        </View>
                                        <Text style={styles.disconnectText}>Disconnect</Text>
                                    </TouchableOpacity>
                                </View>
                            </Pressable>
                        </Animated.View>
                    </GestureDetector>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.bgSemi,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        width: '100%',
        alignItems: 'center',
    },
    innerContentWrapper: {
        flex: 1,
        width: '100%',
    },
    contentContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 34,
        width: '100%',
        paddingHorizontal: 24,
    },
    handleBarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        width: '100%',
    },
    handleBar: {
        width: 64,
        height: 4,
        backgroundColor: colors.bgStroke,
        borderRadius: 100,
    },
    mainInfo: {
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        gap: 16,
    },
    userInfo: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
    },
    avatarContainer: {
        width: 80,
        height: 80,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    addressText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#EDEDED',
    },
    copyButton: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkMark: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
    iconFull: {
        width: '100%',
        height: '100%',
    },
    cardsSection: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        gap: 8,
    },
    balanceCard: {
        backgroundColor: colors.bgStroke,
        borderRadius: 16,
        padding: 16,
        width: '100%',
        gap: 4,
    },
    cardLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.bodyText,
    },
    balanceText: {
        fontFamily: 'Manrope-Bold',
        fontSize: 18,
        color: colors.titleText,
    },
    actionCardsRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 8,
    },
    actionCard: {
        flex: 1,
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        gap: 8,
    },
    iconSmall: {
        width: 24,
        height: 24,
    },
    disconnectButton: {
        width: "100%",
        backgroundColor: '#564100',
        borderRadius: 100,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        // paddingBottom: 24,
    },
    disconnectText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: colors.titleText,
    },
});
