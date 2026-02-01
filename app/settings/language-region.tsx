/**
 * Language & Region Settings Screen
 * 
 * Language and region settings page matching Figma design exactly (node-id: 3279-121043)
 * Optimized with scrollable FlatList bottom sheets and improved animations.
 */

import { StatusBar } from '@/components/ui/StatusBar';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { useLocaleStore } from '@/store/localeStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    BackHandler,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ArrowDownIcon = require('@/assets/home/arrow-down-01.svg');

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
            style={styles.radioButton}
        >
            <View style={styles.radioIndicatorWrapper}>
                {selected ? (
                    <View style={styles.radioSelectedOuter}>
                        <View style={styles.radioSelectedInner} />
                    </View>
                ) : (
                    <View style={styles.radioUnselected} />
                )}
            </View>
            <Text style={styles.radioLabel}>{label}</Text>
        </TouchableOpacity>
    );
};

// Bottom Sheet Component
interface BottomSheetProps {
    visible: boolean;
    onClose: () => void;
    options: { label: string; value: string }[];
    selectedOption: string;
    onSelect: (option: string) => void;
    title: string;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
    visible,
    onClose,
    options,
    selectedOption,
    onSelect,
    title
}) => {
    const { bottom } = useSafeAreaInsets();
    const { height: screenHeight } = Dimensions.get('window');

    // Height logic: Max 70% of screen, min 300
    const sheetHeight = Math.min(screenHeight * 0.7, Math.max(300, options.length * 60 + 100));

    const translateY = useSharedValue(screenHeight);
    const backdropOpacity = useSharedValue(0);

    const [isRendering, setIsRendering] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsRendering(true);
            // Slightly delayed animation to ensure Modal is mounted
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 90,
                mass: 0.8
            });
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            translateY.value = withTiming(screenHeight, {
                duration: 250,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1)
            }, (finished) => {
                if (finished) {
                    runOnJS(setIsRendering)(false);
                }
            });
            backdropOpacity.value = withTiming(0, { duration: 250 });
        }
    }, [visible, screenHeight]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const handleSelect = (option: string) => {
        onSelect(option);
        onClose();
    };

    if (!visible && !isRendering) return null;

    return (
        <Modal
            visible={visible || isRendering}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={{ flex: 1 }}>
                <Pressable style={styles.backdropPressable} onPress={onClose}>
                    <Animated.View style={[styles.backdrop, backdropStyle]} />
                </Pressable>

                <Animated.View
                    style={[
                        styles.sheet,
                        { paddingBottom: (bottom || 24) + 12, height: sheetHeight },
                        sheetStyle,
                    ]}
                >
                    <View style={styles.handle} />
                    <Text style={styles.sheetTitle}>{title}</Text>

                    <FlatList
                        data={options}
                        keyExtractor={(item) => item.value}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.flatListContent}
                        renderItem={({ item }) => (
                            <RadioButton
                                selected={selectedOption === item.value}
                                onPress={() => handleSelect(item.value)}
                                label={item.label}
                            />
                        )}
                    />
                </Animated.View>
            </View>
        </Modal>
    );
};

export default function LanguageRegionScreen() {
    const { top } = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();

    const {
        language, setLanguage, languages,
        currency, setCurrency, currencies,
        dateFormat, setDateFormat
    } = useLocaleStore();

    const [modalConfig, setModalConfig] = useState<{
        visible: boolean;
        type: 'language' | 'currency' | 'format';
        title: string;
        options: { label: string; value: string }[];
        selectedKey: string;
        setter: (val: any) => void;
    }>({
        visible: false,
        type: 'language',
        title: '',
        options: [],
        selectedKey: '',
        setter: () => { }
    });

    const handleBackPress = useCallback(() => {
        if (modalConfig.visible) {
            setModalConfig(prev => ({ ...prev, visible: false }));
            return true;
        }
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/settings' as any);
        }
        return true;
    }, [modalConfig.visible]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => backHandler.remove();
    }, [handleBackPress]);

    const openModal = (type: 'language' | 'currency' | 'format') => {
        if (type === 'language') {
            setModalConfig({
                visible: true,
                type: 'language',
                title: t('locale.language'),
                options: languages.map(l => ({ label: l.nativeName, value: l.code })),
                selectedKey: language,
                setter: setLanguage
            });
        } else if (type === 'currency') {
            setModalConfig({
                visible: true,
                type: 'currency',
                title: t('locale.currency'),
                options: currencies.map(c => ({ label: `${c.code} (${c.symbol}) - ${c.name}`, value: c.code })),
                selectedKey: currency,
                setter: setCurrency
            });
        } else if (type === 'format') {
            setModalConfig({
                visible: true,
                type: 'format',
                title: t('locale.format'),
                options: [
                    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
                    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
                ],
                selectedKey: dateFormat,
                setter: setDateFormat
            });
        }
    };

    const currentLanguageName = languages.find(l => l.code === language)?.nativeName || 'English';

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar />

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
                            style={styles.fullImage}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        {t('locale.title')}
                    </Text>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.formContainer}>
                    {/* Application Language */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>{t('locale.language')}</Text>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => openModal('language')}
                            style={styles.selectTrigger}
                        >
                            <Text style={styles.selectValue}>{currentLanguageName}</Text>
                            <View style={styles.arrowWrapper}>
                                <Image source={ArrowDownIcon} style={styles.fullImage} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Currency Display */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>{t('locale.currency')}</Text>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => openModal('currency')}
                            style={styles.selectTrigger}
                        >
                            <Text style={styles.selectValue}>{currency}</Text>
                            <View style={styles.arrowWrapper}>
                                <Image source={ArrowDownIcon} style={styles.fullImage} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Regional Format */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>{t('locale.format')}</Text>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => openModal('format')}
                            style={styles.selectTrigger}
                        >
                            <Text style={styles.selectValue}>{dateFormat}</Text>
                            <View style={styles.arrowWrapper}>
                                <Image source={ArrowDownIcon} style={styles.fullImage} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <BottomSheet
                visible={modalConfig.visible}
                onClose={() => setModalConfig(prev => ({ ...prev, visible: false }))}
                title={modalConfig.title}
                options={modalConfig.options}
                selectedOption={modalConfig.selectedKey}
                onSelect={(val) => modalConfig.setter(val)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 21 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 10 },
    backButton: { width: 24, height: 24 },
    fullImage: { width: '100%', height: '100%' },
    headerTitle: { fontFamily: 'Manrope-Medium', fontSize: 20, color: colors.titleText, flex: 1, textAlign: 'center' },
    content: { flex: 1, paddingHorizontal: 20, paddingTop: 40, alignItems: 'center' },
    formContainer: { width: '100%', maxWidth: 358, gap: 24 },
    fieldWrapper: { gap: 8 },
    fieldLabel: { fontFamily: 'Manrope-Regular', fontSize: 16, color: colors.titleText },
    selectTrigger: {
        height: 56,
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        paddingHorizontal: 17,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    selectValue: { fontFamily: 'Manrope-Medium', fontSize: 16, color: colors.mutedText, flex: 1 },
    arrowWrapper: { width: 24, height: 24 },
    radioButton: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 },
    radioIndicatorWrapper: { width: 24, height: 24, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
    radioSelectedOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primaryCTA, alignItems: 'center', justifyContent: 'center' },
    radioSelectedInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryCTA },
    radioUnselected: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#444' },
    radioLabel: { fontFamily: 'Manrope-Medium', fontSize: 16, color: colors.titleText, flex: 1 },
    backdropPressable: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    backdrop: { flex: 1, backgroundColor: 'rgba(1,5,1,0.85)' },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 12,
        paddingHorizontal: 8
    },
    handle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 18, color: colors.titleText, textAlign: 'center', marginBottom: 20 },
    flatListContent: { paddingBottom: 20 }
});
