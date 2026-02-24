/**
 * Deposit Selection Modal
 * Bottom sheet for selecting deposit/transfer/receive action
 * Matches Figma node: 3279:112146
 */

import { colors } from '@/constants/colors';
import AntDesign from '@expo/vector-icons/AntDesign';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

// Icons
const DepositIcon = require('../../../assets/home/navigation-03.svg');
const TransferIcon = require('../../../assets/earn/exchange-01.svg');
const ReceiveIcon = require('../../../assets/earn/download-04.svg');
const ArrowRightIcon = require('../../../assets/earn/arrow-right-02.svg');

interface DepositSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (action: 'send' | 'swap' | 'receive') => void;
}

export const DepositSelectionModal: React.FC<DepositSelectionModalProps> = ({
    visible,
    onClose,
    onSelect,
}) => {
    const { height: screenHeight } = Dimensions.get('window');
    // Height ratio based on content
    const sheetHeight = 500;

    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

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

    // Stats (Mock data to match design)
    const stats = {
        tvl: '$1.4M',
        apr: '5.48%',
        totalStaked: '1.1M TWC',
        limits: '0.03-50 TWC',
    };

    const actions = [
        {
            id: 'send',
            title: 'Send',
            subtitle: 'Send crypto from your wallet',
            icon: DepositIcon, // navigation-03.svg
        },
        {
            id: 'swap',
            title: 'Swap',
            subtitle: 'Exchange crypto for TWC',
            icon: TransferIcon, // exchange-01.svg
        },
        {
            id: 'receive',
            title: 'Receive',
            subtitle: 'Receive crypto from others',
            icon: ReceiveIcon, // download-04.svg
        },
    ];

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
                            <Text style={styles.headerTitle}>Select Method</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <AntDesign name="close" size={20} color={colors.titleText} />
                            </TouchableOpacity>
                        </View>

                        {/* Actions List */}
                        <View style={styles.actionsContainer}>
                            {actions.map((action) => (
                                <TouchableOpacity
                                    key={action.id}
                                    style={styles.actionCard}
                                    activeOpacity={0.7}
                                    onPress={() => onSelect(action.id as any)}
                                >
                                    <View style={styles.actionLeft}>
                                        <View style={styles.iconContainer}>
                                            <Image source={action.icon} style={styles.actionIcon} contentFit="contain" />
                                        </View>
                                        <View style={styles.textContainer}>
                                            <Text style={styles.actionTitle}>{action.title}</Text>
                                            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                                        </View>
                                    </View>
                                    <Image source={ArrowRightIcon} style={styles.arrowIcon} contentFit="contain" />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={onClose}
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
        marginBottom: 20,
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
    statsCardWrapper: {
        marginBottom: 24,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: colors.bgSemi,
        borderWidth: 1,
        borderColor: '#273024',
        borderRadius: 12,
        paddingVertical: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    statLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 10,
        color: colors.mutedText,
    },
    statValue: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 12,
        color: colors.titleText,
    },
    divider: {
        width: 1,
        height: '100%',
        backgroundColor: '#273024',
    },
    actionsContainer: {
        gap: 12,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: "#1b1b1b",
        borderRadius: 16,
        padding: 16,
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
    },
    iconContainer: {
        width: 53,
        height: 53,
        borderRadius: 26.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionIcon: {
        width: 24,
        height: 24,
    },
    textContainer: {
        flex: 1,
        gap: 4,
    },
    actionTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.titleText,
    },
    actionSubtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
    },
    arrowIcon: {
        width: 24,
        height: 24,
        tintColor: colors.mutedText,
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
});
