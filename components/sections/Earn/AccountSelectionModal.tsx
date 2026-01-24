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
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';


const CheckIcon = require('../../../assets/earn/checkmark-square-01.svg'); // Need to ensure this exists
// const AddIcon = require('../../../assets/earn/add-01.svg');

export interface Account {
    id: string;
    name: string;
    balance: string;
    type: string;
}

interface AccountSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (account: Account) => void;
    selectedAccountId?: string;
}

const MOCK_ACCOUNTS: Account[] = [
    { id: '1', name: 'Funding Account', balance: '0.0210 BTC', type: 'Tier 1' },
    { id: '2', name: 'Unified Trading Account', balance: '0.0000 BTC', type: 'Tier 2' },
];

export const AccountSelectionModal: React.FC<AccountSelectionModalProps> = ({
    visible,
    onClose,
    onSelect,
    selectedAccountId,
}) => {
    const { height: screenHeight } = Dimensions.get('window');
    // Height ratio based on content
    const sheetHeight = 450;

    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    const [activeAccount, setActiveAccount] = useState<string>(selectedAccountId!);

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
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
                        <View style={styles.handleWrapper}>
                            <View style={styles.handle} />
                        </View>

                        {/* Header Row */}
                        <View style={styles.headerRow}>
                            <View style={{ width: 40 }} /> {/* Spacer for centering */}
                            <Text style={styles.headerTitle}>Select accounts</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <AntDesign name="close" size={20} color={colors.titleText} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ backgroundColor: colors.bgSemi, borderRadius: 14, padding: 14 }}>
                            {/* Total Available */}
                            <View style={styles.totalAvailableRow}>
                                <Text style={styles.totalLabel}>Total available</Text>
                                <Text style={styles.totalValue}>0.0053 TWC</Text>
                            </View>

                            <View style={styles.listContainer}>
                                {MOCK_ACCOUNTS.map((account) => {
                                    const isSelected = activeAccount === account.id;
                                    return (
                                        <TouchableOpacity
                                            key={account.id}
                                            onPress={() => setActiveAccount(account.id)}
                                            activeOpacity={0.7}
                                            style={[
                                                styles.accountItem,
                                                isSelected && styles.accountItemActive
                                            ]}
                                        >
                                            <View style={styles.accountInfo}>
                                                <View style={styles.typeBadge}>
                                                    <Text style={[styles.accountType, { color: colors.mutedText, fontSize: 12, marginRight: 4 }]}>{account.type}</Text>
                                                    <Text style={styles.accountType}>{account.name}</Text>
                                                </View>
                                                <Text style={styles.accountBalance}>Available Balance: {account.balance}</Text>
                                            </View>

                                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                                {/* {isSelected && (
                                                    <Image
                                                        source={CheckIcon}
                                                        style={styles.checkIcon}
                                                        contentFit="contain"
                                                    />
                                                )} */}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Image source={require('../../../assets/earn/alert-diamond.svg')} style={{ width: 16, height: 16, tintColor: colors.mutedText }} contentFit="contain" />
                                    <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 12, color: colors.mutedText, flex: 1 }}>
                                        Insufficient funds will be automatically deducted from your trading account
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={() => {
                                const selected = MOCK_ACCOUNTS.find(a => a.id === activeAccount);
                                if (selected) {
                                    onSelect(selected);
                                }
                                onClose();
                            }}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </GestureDetector>
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
        backgroundColor: '#1B1B1B', // Darker background from design
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
        backgroundColor: 'rgba(129, 129, 129, 0.12)', // Subtle circle bg
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        gap: 12,
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
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
    },
    accountItemActive: {
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
    },
    accountInfo: {
        gap: 4,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    accountType: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.titleText,
    },
    accountBalance: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: colors.mutedText,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: colors.mutedText,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: colors.primaryCTA,
        borderColor: colors.primaryCTA,
    },
    checkIcon: {
        width: 12,
        height: 12,
        tintColor: '#050201', // Dark icon on lime green
    },
    confirmButton: {
        marginTop: 24,
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
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
        marginTop: 8,
    },
    addButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 14,
        color: colors.primaryCTA,
    },
});
