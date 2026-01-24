import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ArrowDownIcon = require('../../../assets/home/arrow-down-01.svg');

type AutoLockOption = 'Immediately' | '30 seconds' | '1 Minute' | '5 Minutes' | '10 Minutes' | 'Never';

const AUTO_LOCK_OPTIONS: AutoLockOption[] = [
    'Immediately',
    '30 seconds',
    '1 Minute',
    '5 Minutes',
    '10 Minutes',
    'Never',
];

interface RadioButtonProps {
    selected: boolean;
    onPress: () => void;
    label: string;
}

const RadioButton: React.FC<RadioButtonProps> = ({ selected, onPress, label }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={styles.radioButton}
        >
            <View style={styles.radioOuter}>
                {selected ? (
                    <View style={styles.radioSelectedOuter}>
                        <View style={styles.radioSelectedInner} />
                    </View>
                ) : (
                    <View style={styles.radioUnselected} />
                )}
            </View>
            <ThemedText style={styles.radioLabel}>{label}</ThemedText>
        </TouchableOpacity>
    );
};

export default function AutoLockTimerScreen() {
    const { bottom } = useSafeAreaInsets();
    const [selectedOption, setSelectedOption] = useState<AutoLockOption>('Immediately');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const handleOptionSelect = (option: AutoLockOption) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedOption(option);
        setIsModalVisible(false);
    };

    const { height: screenHeight } = Dimensions.get('window');
    const sheetHeight = Math.min(AUTO_LOCK_OPTIONS.length * 60 + 100, screenHeight * 0.6);
    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    const openSheet = () => {
        setIsModalVisible(true);
        translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
        backdropOpacity.value = withTiming(1, { duration: 250 });
    };

    const closeSheet = () => {
        translateY.value = withTiming(sheetHeight, { duration: 250 }, (finished) => {
            if (finished) runOnJS(setIsModalVisible)(false);
        });
        backdropOpacity.value = withTiming(0, { duration: 250 });
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
            if (event.translationY > 80) {
                runOnJS(closeSheet)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
            }
        });

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Autolock Timer" />

            <View style={styles.content}>
                <View style={styles.inputGroup}>
                    <ThemedText style={styles.label}>
                        Auto-lock will engage after
                    </ThemedText>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={openSheet}
                        style={styles.selector}
                    >
                        <ThemedText style={styles.selectorText}>
                            {selectedOption}
                        </ThemedText>
                        <View style={styles.icon24}>
                            <Image
                                source={ArrowDownIcon}
                                style={styles.fullSize}
                                contentFit="contain"
                            />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <Modal
                visible={isModalVisible}
                transparent
                animationType="none"
                onRequestClose={closeSheet}
                statusBarTranslucent
            >
                <View style={styles.modalRoot}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet}>
                        <Animated.View style={[styles.backdrop, backdropStyle]} />
                    </Pressable>

                    <GestureDetector gesture={panGesture}>
                        <Animated.View
                            style={[
                                styles.sheet,
                                { paddingBottom: (bottom || 24) + 24, height: sheetHeight },
                                sheetStyle,
                            ]}
                        >
                            <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                                <View style={styles.sheetContent}>
                                    {AUTO_LOCK_OPTIONS.map((option) => (
                                        <RadioButton
                                            key={option}
                                            selected={selectedOption === option}
                                            onPress={() => handleOptionSelect(option)}
                                            label={option}
                                        />
                                    ))}
                                </View>
                            </Pressable>
                        </Animated.View>
                    </GestureDetector>
                </View>
            </Modal>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 18,
        paddingTop: 100,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 16,
        opacity: 0.8,
    },
    selector: {
        height: 56,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectorText: {
        fontSize: 16,
        color: colors.mutedText,
    },
    icon24: {
        width: 24,
        height: 24,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
    modalRoot: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(1,5,1,0.7)',
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1b1b1b',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingTop: 32,
        paddingHorizontal: 20,
    },
    sheetContent: {
        gap: 4,
    },
    radioButton: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    radioOuter: {
        width: 24,
        height: 24,
    },
    radioSelectedOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelectedInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
    },
    radioUnselected: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#b5b5b5',
    },
    radioLabel: {
        fontSize: 16,
    },
});
