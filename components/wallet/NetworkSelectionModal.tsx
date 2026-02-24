import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { ChainType } from '@/store/walletStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
const SuiLogo = require('../../assets/home/chains/sui.svg');
const TonLogo = require('../../assets/home/chains/ton.jpg');
const TronLogo = require('../../assets/home/chains/tron.png');
const BscLogo = require('../../assets/home/chains/bsc.svg');
const PolyLogo = require('../../assets/home/chains/polygon.svg');
const BaseLogo = require('../../assets/home/chains/base.png');
const OptimismLogo = require('../../assets/home/chains/optimism.png');

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
}

const NETWORK_OPTIONS: NetworkOption[] = [
    {
        id: 'MULTI',
        label: 'Standard Multi-Chain Wallet',
        subtext: 'One seed, all ecosystems. (Primarily EVM)',
        icons: [EthLogo, SolLogo, TonLogo, TronLogo],
        isTall: true,
    },
    {
        id: 'EVM',
        label: 'EVM-compatible network',
        subtext: 'Supports Ethereum, BNB Chain, Base, Optimism, and 20+ other EVM networks.',
        icons: [EthLogo, BscLogo, BaseLogo, OptimismLogo],
        isTall: true,
    },
    {
        id: 'SOLANA',
        label: 'Solana',
        icons: [SolLogo],
    },
    {
        id: 'SUI',
        label: 'Sui',
        icons: [SuiLogo],
    },
    {
        id: 'TON',
        label: 'Ton',
        icons: [TonLogo],
    },
    {
        id: 'TRON',
        label: 'Tron',
        icons: [TronLogo],
    },
];

export const NetworkSelectionModal: React.FC<NetworkSelectionModalProps> = ({
    visible,
    onClose,
    onSelect,
    mode,
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
                            scrollEnabled={true}
                        >
                                {NETWORK_OPTIONS.map((option) => {
                                    const isSelected = selected === option.id;
                                    const isDisabled = mode === 'privateKey' && option.id === 'MULTI';
                                    const isMulti = option.id === 'MULTI' || option.id === 'EVM';

                                    if (isDisabled) return null;

                                    return (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[
                                                styles.optionCard,
                                                option.isTall && !isMulti && styles.tallCard,
                                                isSelected && styles.selectedCard,
                                            ]}
                                            onPress={() => setSelected(option.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.optionHeader}>
                                                <View style={styles.iconContainer}>
                                                    {option.icons.map((icon, idx) => (
                                                        <View
                                                            key={idx}
                                                            style={[
                                                                isMulti ? styles.miniIconCircle : styles.iconCircle,
                                                                { marginLeft: idx > 0 ? (isMulti ? -8 : -12) : 0, }
                                                            ]}
                                                        >
                                                            <Image
                                                                source={icon}
                                                                style={styles.chainIcon}
                                                                contentFit="contain"
                                                            />
                                                        </View>
                                                    ))}
                                                </View>
                                                <Text 
                                                    style={[
                                                        styles.optionLabel, 
                                                        isMulti && styles.multiLabel,
                                                        isSelected && styles.selectedLabel
                                                    ]}
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                >
                                                    {option.label}
                                                </Text>
                                                {isSelected && (
                                                    <MaterialCommunityIcons name="check" size={20} color={colors.primaryCTA} />
                                                )}
                                            </View>

                                            {!isMulti && option.subtext && (
                                                <Text style={styles.subtext}>{option.subtext}</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>

                        <View style={[styles.footer, { paddingBottom: 12 }]}>
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
        paddingHorizontal: 24,
        paddingTop: 12,
        maxHeight: '75%',
        width: '100%',
    },
    dragArea: {
        width: '100%',
        paddingTop: 12,
        // No vertical padding here to keep handle and title close
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: colors.bgStroke,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16, // Reduced margin
    },
    title: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.xl,
        color: colors.titleText,
        marginBottom: 20, // Reduced margin
    },
    scrollArea: {
        flexGrow: 1,
        flexShrink: 1,
        width: '100%',
        maxHeight: 450,
    },
    optionsContainer: {
        gap: 12,
        paddingBottom: 32,
    },
    optionCard: {
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        padding: 16,
    },
    tallCard: {
        paddingVertical: 20,
    },
    selectedCard: {
        borderColor: colors.primaryCTA,
        backgroundColor: 'rgba(177, 241, 40, 0.05)',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 32,
        height: 32,
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
    chainIcon: {
        borderRadius: 16,
        width: '100%',
        height: '100%',
    },
    optionLabel: {
        flex: 1,
        fontFamily: typography.fontFamily.semibold,
        fontSize: typography.fontSize.md,
        color: colors.titleText,
    },
    multiLabel: {
        fontSize: 14, // Smaller text for multi-chain one-liners
    },
    selectedLabel: {
        color: colors.primaryCTA,
    },
    subtext: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.fontSize.xs,
        color: colors.bodyText,
        marginTop: 8,
        lineHeight: 18,
    },
    confirmButton: {
        backgroundColor: colors.primaryCTA,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        paddingTop: 16,
        width: '100%',
    },
    disabledButton: {
        backgroundColor: colors.bgStroke,
        opacity: 0.5,
    },
    confirmText: {
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.fontSize.md,
        color: colors.bg,
    },
});
