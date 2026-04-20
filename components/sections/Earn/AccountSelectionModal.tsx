/**
 * Account Selection Modal
 * Bottom sheet for selecting funding account
 * Features blur backdrop and smooth sliding animation
 */

import { colors } from '@/constants/colors';
import AntDesign from '@expo/vector-icons/AntDesign';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';


const CheckIcon = require('../../../assets/earn/checkmark-square-01.svg');
const CheckboxIcon = require('../../../assets/wallet/checkbox.svg');

export interface Account {
    id: string;
    name: string;
    balance: string;
    type: string;
    address?: string;
}

interface AccountSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (account: Account) => void;
    selectedAccountId?: string;
    accounts: Account[];
    totalBalance?: string;
}

export const AccountSelectionModal: React.FC<AccountSelectionModalProps> = ({
    visible,
    onClose,
    onSelect,
    selectedAccountId,
    accounts = [],
    totalBalance = '0.00'
}) => {
    // Standard height to match other selection modals (e.g. DepositSelectionModal)
    const sheetHeight = 500;

    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    const [activeAccount, setActiveAccount] = useState<string>(selectedAccountId || '');

    useEffect(() => {
        if (selectedAccountId) {
            setActiveAccount(selectedAccountId);
        }
    }, [selectedAccountId]);

    useEffect(() => {
        if (visible) {
            // Smooth slide up
            translateY.value = withTiming(0, {
                duration: 350,
                easing: Easing.out(Easing.cubic),
            });
            backdropOpacity.value = withTiming(1, { duration: 350 });
        } else {
            // Smooth slide down
            translateY.value = withTiming(sheetHeight, {
                duration: 300,
                easing: Easing.in(Easing.cubic),
            });
            backdropOpacity.value = withTiming(0, { duration: 300 });
        }
    }, [visible, sheetHeight]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const startY = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, Math.min(sheetHeight, startY.value + event.translationY));
        })
        .onEnd((event) => {
            if (event.translationY > 100) {
                translateY.value = withTiming(sheetHeight, { duration: 300 }, (finished) => {
                    if (finished) runOnJS(onClose)();
                });
                backdropOpacity.value = withTiming(0, { duration: 300 });
            } else {
                translateY.value = withTiming(0, {
                    duration: 300,
                    easing: Easing.out(Easing.cubic),
                });
            }
        });

    const handleSelect = (account: Account) => {
        setActiveAccount(account.id);

        // Delay close to show selection feedback
        setTimeout(() => {
            onSelect(account);
            onClose();
        }, 150);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <GestureHandlerRootView style={styles.container}>
                {/* Blur Backdrop */}
                <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
                    <BlurView
                        style={StyleSheet.absoluteFill}
                        intensity={20}
                        tint="dark"
                    />
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>

                {/* Bottom Sheet */}
                <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
                    {/* Draggable Header */}
                    <GestureDetector gesture={panGesture}>
                        <View>
                            <View style={styles.handleWrapper}>
                                <View style={styles.handle} />
                            </View>

                            {/* Header Row */}
                            <View style={styles.headerRow}>
                                <View style={{ width: 40 }} />
                                <Text style={styles.headerTitle}>Select account</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <AntDesign name="close" size={20} color={colors.titleText} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </GestureDetector>

                    <View style={styles.contentContainer}>
                        {/* Total Available */}
                        <View style={styles.totalAvailableRow}>
                            <Text style={styles.totalLabel}>Total available</Text>
                            <Text style={styles.totalValue}>{totalBalance}</Text>
                        </View>

                        <ScrollView
                            style={styles.scrollArea}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContainer}
                        >
                            {accounts.map((account) => {
                                const isSelected = activeAccount === account.id;
                                return (
                                    <TouchableOpacity
                                        key={account.id}
                                        onPress={() => handleSelect(account)}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.accountItem,
                                            isSelected && styles.accountItemActive
                                        ]}
                                    >
                                        <View style={styles.accountInfo}>
                                            <Text style={styles.accountName}>{account.name}</Text>
                                            <Text style={styles.accountBalance}>Available Balance: {account.balance}</Text>
                                        </View>

                                        <View style={styles.checkboxContainer}>
                                            {isSelected ? (
                                                <Image
                                                    source={CheckIcon}
                                                    style={[styles.checkIcon, { tintColor: colors.primaryCTA }]}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Image
                                                    source={CheckboxIcon}
                                                    style={styles.checkboxEmptyIcon}
                                                    contentFit="contain"
                                                />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={() => {
                            const selected = accounts.find(a => a.id === activeAccount);
                            if (selected) {
                                onSelect(selected);
                            }
                            onClose();
                        }}
                    >
                        <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>

                    <View style={{ height: 32 }} />
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        backgroundColor: '#1B1B1B',
        overflow: 'hidden',
        paddingHorizontal: 20,
    },
    handleWrapper: {
        marginTop: 12,
        alignItems: 'center',
        width: '100%',
    },
    handle: {
        width: 48,
        height: 4,
        borderRadius: 100,
        backgroundColor: colors.mutedText,
        opacity: 0.5,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 24,
        marginBottom: 32,
    },
    headerTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(129, 129, 129, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        gap: 12,
        paddingBottom: 20,
    },
    contentContainer: {
        backgroundColor: colors.bgSemi,
        borderRadius: 14,
        padding: 14,
        flex: 1,
    },
    scrollArea: {
        flex: 1,
    },
    totalAvailableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    totalLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.mutedText,
    },
    totalValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    accountItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#262626',
        borderRadius: 16,
        marginBottom: 8,
    },
    accountItemActive: {
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
        borderWidth: 1,
        borderColor: colors.primaryCTA,
    },
    accountInfo: {
        gap: 4,
        flex: 1,
    },
    accountName: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    accountBalance: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    checkboxContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    checkIcon: {
        width: 24,
        height: 24,
    },
    checkboxEmptyIcon: {
        width: 20,
        height: 20,
        opacity: 0.5,
    },
    confirmButton: {
        marginTop: 20,
        backgroundColor: colors.primaryCTA,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#050201',
    },
});
