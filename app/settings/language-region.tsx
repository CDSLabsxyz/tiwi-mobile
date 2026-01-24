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
    ScrollView,
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

const ArrowDownIcon = require('../../assets/home/arrow-down-01.svg');

type Language = 'English' | 'French' | 'Spanish' | 'Chinese' | 'Arabic' | 'Portuguese';
type Currency = 'USD' | 'EUR' | 'NGN' | 'GBP' | 'CNY' | 'JPY';
type RegionalFormat = 'MM/DD/YY' | 'DD/MM/YY' | 'YYYY-MM-DD';

const LANGUAGES: Language[] = ['English', 'French', 'Spanish', 'Chinese', 'Arabic', 'Portuguese'];
const CURRENCIES: Currency[] = ['USD', 'EUR', 'NGN', 'GBP', 'CNY', 'JPY'];
const REGIONAL_FORMATS: RegionalFormat[] = ['MM/DD/YY', 'DD/MM/YY', 'YYYY-MM-DD'];

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

export default function LanguageRegionScreen() {
    const { bottom } = useSafeAreaInsets();
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('English');
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>('USD');
    const [selectedFormat, setSelectedFormat] = useState<RegionalFormat>('MM/DD/YY');

    const [activeModal, setActiveModal] = useState<'language' | 'currency' | 'format' | null>(null);

    const handleSelect = (option: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (activeModal === 'language') setSelectedLanguage(option as Language);
        else if (activeModal === 'currency') setSelectedCurrency(option as Currency);
        else if (activeModal === 'format') setSelectedFormat(option as RegionalFormat);

        closeSheet();
    };

    const { height: screenHeight } = Dimensions.get('window');
    const sheetHeight = screenHeight * 0.5;
    const translateY = useSharedValue(sheetHeight);
    const backdropOpacity = useSharedValue(0);

    const openSheet = (type: 'language' | 'currency' | 'format') => {
        setActiveModal(type);
        translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
        backdropOpacity.value = withTiming(1, { duration: 250 });
    };

    const closeSheet = () => {
        translateY.value = withTiming(sheetHeight, { duration: 250 }, (finished) => {
            if (finished) runOnJS(setActiveModal)(null);
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

    const getOptions = () => {
        if (activeModal === 'language') return LANGUAGES;
        if (activeModal === 'currency') return CURRENCIES;
        if (activeModal === 'format') return REGIONAL_FORMATS;
        return [];
    };

    const getActiveOption = () => {
        if (activeModal === 'language') return selectedLanguage;
        if (activeModal === 'currency') return selectedCurrency;
        if (activeModal === 'format') return selectedFormat;
        return '';
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Language & Region" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
            >
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.inputLabel}>Application Language</ThemedText>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => openSheet('language')}
                            style={styles.selector}
                        >
                            <ThemedText style={styles.selectorText}>{selectedLanguage}</ThemedText>
                            <View style={styles.icon24}>
                                <Image source={ArrowDownIcon} style={styles.fullSize} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.inputLabel}>Currency Display</ThemedText>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => openSheet('currency')}
                            style={styles.selector}
                        >
                            <ThemedText style={styles.selectorText}>{selectedCurrency}</ThemedText>
                            <View style={styles.icon24}>
                                <Image source={ArrowDownIcon} style={styles.fullSize} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <ThemedText style={styles.inputLabel}>Regional Format</ThemedText>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => openSheet('format')}
                            style={styles.selector}
                        >
                            <ThemedText style={styles.selectorText}>{selectedFormat}</ThemedText>
                            <View style={styles.icon24}>
                                <Image source={ArrowDownIcon} style={styles.fullSize} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <Modal
                visible={!!activeModal}
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
                                { paddingBottom: (bottom || 24) + 24 },
                                sheetStyle,
                            ]}
                        >
                            <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
                                <View style={styles.sheetContent}>
                                    {getOptions().map((option) => (
                                        <RadioButton
                                            key={option}
                                            selected={getActiveOption() === option}
                                            onPress={() => handleSelect(option)}
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
        alignItems: 'center',
    },
    formContainer: {
        width: '100%',
        maxWidth: 358,
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
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
        minHeight: 300,
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
