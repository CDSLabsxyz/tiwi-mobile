import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useSecurityStore } from '@/store/securityStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    BackHandler,
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
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

const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');
const ArrowDownIcon = require('../../../assets/home/arrow-down-01.svg');

type AutoLockOption = {
    label: string;
    value: number;
};

const TIMER_OPTIONS: AutoLockOption[] = [
    { label: 'Immediately', value: 0 },
    { label: '30 seconds', value: 30000 },
    { label: '1 Minute', value: 60000 },
    { label: '5 Minutes', value: 300000 },
    { label: '10 Minutes', value: 600000 },
    { label: 'Never', value: -1 },
];

// Radio Button Component
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
            style={styles.radioItem}
        >
            <View style={styles.radioShell}>
                {selected ? (
                    <View style={styles.radioOuterSelected}>
                        <View style={styles.radioInnerSelected} />
                    </View>
                ) : (
                    <View style={styles.radioUnselected} />
                )}
            </View>
            <Text style={styles.radioLabel}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};

export default function AutoLockTimerScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { autoLockTimeout, setAutoLockTimeout } = useSecurityStore();
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Get current label based on timeout
    const currentOption = TIMER_OPTIONS.find(o => o.value === autoLockTimeout) || TIMER_OPTIONS[0];

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isModalVisible) {
                setIsModalVisible(false);
                return true;
            }
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [isModalVisible]);

    const handleBackPress = () => {
        router.back();
    };

    const handleOptionSelect = (option: AutoLockOption) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAutoLockTimeout(option.value);
        setIsModalVisible(false);
    };

    // Bottom sheet animation
    const { height: screenHeight } = Dimensions.get('window');
    const sheetHeight = 450;
    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (isModalVisible) {
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 90,
            });
            backdropOpacity.value = withTiming(1, { duration: 250 });
        } else {
            translateY.value = withTiming(sheetHeight, { duration: 250 });
            backdropOpacity.value = withTiming(0, { duration: 250 });
        }
    }, [isModalVisible, sheetHeight]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const closeSheet = () => {
        setIsModalVisible(false);
    };

    const startY = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            startY.value = translateY.value;
        })
        .onUpdate((event) => {
            const next = startY.value + event.translationY;
            translateY.value = Math.max(0, Math.min(sheetHeight, next));
        })
        .onEnd((event) => {
            if (event.translationY > 80) {
                translateY.value = withTiming(
                    sheetHeight,
                    { duration: 250 },
                    (finished) => {
                        if (finished) {
                            runOnJS(closeSheet)();
                        }
                    }
                );
                backdropOpacity.value = withTiming(0, { duration: 250 });
            } else {
                translateY.value = withSpring(0, {
                    damping: 20,
                    stiffness: 90,
                });
            }
        });

    return (
        <View style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        Autolock Timer
                    </Text>
                    <View style={styles.placeholder} />
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.selectorGroup}>
                    <Text style={styles.selectorLabel}>
                        Auto-lock will engage after
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setIsModalVisible(true)}
                        style={styles.selectorButton}
                    >
                        <Text style={styles.selectorText}>
                            {currentOption.label}
                        </Text>
                        <Image
                            source={ArrowDownIcon}
                            style={styles.arrowIcon}
                            contentFit="contain"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Sheet Modal */}
            <Modal
                visible={isModalVisible}
                transparent
                animationType="none"
                onRequestClose={closeSheet}
                statusBarTranslucent
            >
                <View style={styles.modalOverlay}>
                    {/* Backdrop */}
                    <Pressable style={styles.backdropPressable} onPress={closeSheet}>
                        <Animated.View style={[styles.backdrop, backdropStyle]} />
                    </Pressable>

                    {/* Bottom Sheet */}
                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[styles.bottomSheet, sheetStyle, { paddingBottom: (bottom || 24) + 24 }]}>
                            <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheetContent}>
                                <View style={styles.sheetHandle} />
                                <View style={styles.radioList}>
                                    {TIMER_OPTIONS.map((option) => (
                                        <RadioButton
                                            key={option.value}
                                            selected={autoLockTimeout === option.value}
                                            onPress={() => handleOptionSelect(option)}
                                            label={option.label}
                                        />
                                    ))}
                                </View>
                            </Pressable>
                        </Animated.View>
                    </GestureDetector>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050201',
    },
    header: {
        backgroundColor: '#050201',
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    backButton: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        lineHeight: 20,
        color: '#FFFFFF',
        flex: 1,
        textAlign: 'center',
    },
    placeholder: {
        width: 24,
    },
    content: {
        flex: 1,
        paddingHorizontal: 18,
        paddingTop: 80,
    },
    selectorGroup: {
        gap: 12,
        width: '100%',
    },
    selectorLabel: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    selectorButton: {
        height: 56,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 17,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectorText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
        flex: 1,
    },
    arrowIcon: {
        width: 24,
        height: 24,
    },
    modalOverlay: {
        flex: 1,
    },
    backdropPressable: {
        ...StyleSheet.absoluteFillObject,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(1,5,1,0.7)',
    },
    bottomSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1b1b1b',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingTop: 16,
        paddingHorizontal: 17,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetContent: {
        flex: 1,
    },
    radioList: {
        gap: 4,
    },
    radioItem: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 17,
        borderRadius: 16,
    },
    radioShell: {
        width: 24,
        height: 24,
        marginRight: 12,
    },
    radioOuterSelected: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#B4FF3B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInnerSelected: {
        width: 10,
        height: 10,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#B4FF3B',
    },
    radioUnselected: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    radioLabel: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
        color: '#FFFFFF',
        flex: 1,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
