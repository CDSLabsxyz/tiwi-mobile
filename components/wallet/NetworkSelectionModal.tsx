import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { ChainType } from '@/store/walletStore';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TiwiLogo = require('../../assets/home/tiwicat.svg');
const EthLogo = require('../../assets/home/chains/ethereum.svg');
const SolLogo = require('../../assets/home/chains/solana.jpg');
const BscLogo = require('../../assets/home/chains/bsc.svg');
const PolyLogo = require('../../assets/home/chains/polygon.svg');
const BaseLogo = require('../../assets/home/chains/base.png');
const AllNetworkLogo = require('../../assets/swap/all-networks.svg');

interface NetworkOption {
    id: ChainType | 'MULTI';
    label: string;
    subtext?: string;
    icons: any[]; // Asset requires
    isTall?: boolean;
}

interface NetworkSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (network: ChainType | 'MULTI') => void;
    mode: 'mnemonic' | 'privateKey';
    compatibleChains?: ChainType[];
}

const NETWORK_OPTIONS: NetworkOption[] = [
    {
        id: 'MULTI',
        label: 'Multi-Chain Wallet',
        subtext: 'One seed, all ecosystems. (Recommended)',
        icons: [EthLogo, SolLogo],
        isTall: true,
    },
    {
        id: 'EVM',
        label: 'EVM-Compatible',
        subtext: 'Supports Ethereum, BNB Chain, Base, OP, and more.',
        icons: [EthLogo, BscLogo, PolyLogo],
        isTall: true,
    },
    {
        id: 'SOLANA',
        label: 'Solana',
        // subtext: 'Fast, secure, and scalable high-performance network.',
        icons: [SolLogo],
    },
];

export const NetworkSelectionModal: React.FC<NetworkSelectionModalProps> = ({
    visible,
    onClose,
    onSelect,
    mode,
    compatibleChains = [],
}) => {
    const { bottom } = useSafeAreaInsets();
    const [selected, setSelected] = useState<ChainType | 'MULTI' | null>(null);

    const modalHeight = 650;
    const translateY = useSharedValue(modalHeight);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            translateY.value = withTiming(0, {
                duration: 400,
                easing: Easing.out(Easing.cubic),
            });
            opacity.value = withTiming(1, { duration: 400 });
            // Default selection for mnemonic
            if (mode === 'mnemonic') {
                setSelected('MULTI');
            } else {
                setSelected(null);
            }
        } else {
            translateY.value = withTiming(modalHeight, { duration: 300 });
            opacity.value = withTiming(0, { duration: 300 });
        }
    }, [visible, mode]);

    const modalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const handleConfirm = () => {
        if (selected) {
            onSelect(selected);
            onClose();
        }
    };

    const context = useSharedValue({ y: 0 });
    const panGesture = Gesture.Pan()
        .activeOffsetY(5) // Active almost immediately on downward drag
        .failOffsetY(-5) // Fail immediately on upward drag to allow scrolling
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
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.overlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                        <Animated.View style={[styles.backdrop, backdropStyle]} />
                    </Pressable>

                    <Animated.View style={[styles.content, modalStyle]}>
                        <GestureDetector gesture={panGesture}>
                            <View style={styles.dragArea}>
                                <View style={styles.handle} />
                                <Text style={styles.title}>Select network</Text>
                            </View>
                        </GestureDetector>

                        <ScrollView
                            style={styles.scrollArea}
                            contentContainerStyle={styles.optionsContainer}
                            showsVerticalScrollIndicator={false}
                            bounces={true}
                        >
                            {NETWORK_OPTIONS.map((option) => {
                                const isSelected = selected === option.id;
                                const isDisabled = mode === 'privateKey' && option.id === 'MULTI';

                                // Filter based on compatibility if in privateKey mode
                                const isCompatible = mode === 'mnemonic' ||
                                    option.id === 'MULTI' ||
                                    compatibleChains.includes(option.id as ChainType);

                                if (isDisabled || !isCompatible) return null;

                                const isStacked = option.icons.length > 1;

                                return (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.optionCard,
                                            isSelected && styles.selectedCard,
                                            option.isTall && styles.tallCard,
                                        ]}
                                        onPress={() => setSelected(option.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.optionContent}>
                                            <View style={styles.iconWrapper}>
                                                <View style={styles.iconContainer}>
                                                    {option.icons.map((icon, idx) => (
                                                        <View
                                                            key={idx}
                                                            style={[
                                                                styles.iconCircle,
                                                                isStacked && styles.stackedIcon,
                                                                isStacked && { left: idx * 16, zIndex: 10 - idx }
                                                            ]}
                                                        >
                                                            <Image
                                                                source={icon}
                                                                style={styles.chainIcon}
                                                                contentFit="contain"
                                                                priority="high"
                                                            />
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>

                                            <View style={styles.textWrapper}>
                                                <Text style={[
                                                    styles.optionLabel,
                                                    isSelected && styles.selectedLabel
                                                ]}>
                                                    {option.label}
                                                </Text>
                                                {option.subtext && (
                                                    <Text style={styles.subtext} numberOfLines={1}>
                                                        {option.subtext}
                                                    </Text>
                                                )}
                                            </View>

                                            <View style={styles.radioContainer}>
                                                <View style={[
                                                    styles.radioButton,
                                                    isSelected && styles.radioActive
                                                ]}>
                                                    {isSelected && <View style={styles.radioInner} />}
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={[styles.footer, { paddingBottom: bottom || 24 }]}>
                            <TouchableOpacity
                                style={[styles.confirmButton, !selected && styles.disabledButton]}
                                onPress={handleConfirm}
                                disabled={!selected}
                            >
                                <Text style={styles.confirmText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                    {/* </Animated.View> */}
                </View>
            </GestureHandlerRootView>
        </Modal >
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    content: {
        backgroundColor: colors.bgSemi,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 16,
        paddingTop: 12,
        maxHeight: '70%',
        width: '100%',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: colors.bgStroke,
    },
    dragArea: {
        width: '100%',
        paddingVertical: 12,
    },
    handle: {
        width: 36,
        height: 5,
        backgroundColor: colors.bgStroke,
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 20,
    },
    title: {
        fontFamily: typography.fontFamily.bold,
        fontSize: 22,
        color: colors.titleText,
        paddingHorizontal: 8,
    },
    scrollArea: {
        width: '100%',
    },
    optionsContainer: {
        gap: 8,
        paddingBottom: 40,
        paddingHorizontal: 8,
    },
    optionCard: {
        backgroundColor: colors.bgCards,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        padding: 16,
        height: 72,
        justifyContent: 'center',
    },
    tallCard: {
        paddingVertical: 20,
    },
    selectedCard: {
        borderColor: colors.primaryCTA,
        backgroundColor: 'rgba(177, 241, 40, 0.08)',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrapper: {
        width: 64, // Sufficient space for stacked icons
        marginRight: 12,
    },
    iconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1.5,
        borderColor: colors.bgStroke,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    miniIconCircle: {
        width: 24, // Smaller icons for multi-chain rows
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    stackedIcon: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    chainIcon: {
        width: '100%',
        height: '100%',
    },
    textWrapper: {
        flex: 1,
        justifyContent: 'center',
    },
    optionLabel: {
        fontFamily: typography.fontFamily.semibold,
        fontSize: 16,
        color: colors.titleText,
        marginBottom: 2,
    },
    multiLabel: {
        fontSize: 14, // Smaller text for multi-chain one-liners
    },
    selectedLabel: {
        color: colors.primaryCTA,
    },
    subtext: {
        fontFamily: typography.fontFamily.medium,
        fontSize: 12,
        color: colors.mutedText,
    },
    radioContainer: {
        width: 24,
        alignItems: 'flex-end',
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.bgStroke,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioActive: {
        borderColor: colors.primaryCTA,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primaryCTA,
    },
    confirmButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primaryCTA,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    footer: {
        paddingTop: 16,
        paddingBottom: 24,
        paddingHorizontal: 8,
        width: '100%',
    },
    disabledButton: {
        backgroundColor: colors.bgStroke,
        shadowOpacity: 0,
        elevation: 0,
    },
    confirmText: {
        fontFamily: typography.fontFamily.bold,
        fontSize: 18,
        color: colors.bg,
    },
});
