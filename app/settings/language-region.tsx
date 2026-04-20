/**
 * Language & Region Settings Screen.
 *
 * Mirrors the Tiwi Super App (`components/settings/language-region.tsx`):
 * the user picks a language from the full 200+ LANGUAGES list, then
 * currency and date format are auto-derived via `getLocaleFromLanguage`.
 * An Apply button commits the selection to the locale store.
 */

import { StatusBar } from '@/components/ui/StatusBar';
import { colors } from '@/constants/colors';
import { useTranslation } from '@/hooks/useLocalization';
import { LANGUAGES, getLanguageByCode } from '@/lib/locale/constants';
import { languageToFlag } from '@/lib/locale/language-flag';
import { getLocaleFromLanguage } from '@/lib/locale/language-to-region';
import { useLocaleStore } from '@/store/localeStore';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BackHandler,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
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

interface LanguageOption {
    code: string;
    name: string;
}

interface LanguageSheetProps {
    visible: boolean;
    onClose: () => void;
    selectedCode: string;
    onSelect: (code: string) => void;
    title: string;
    searchPlaceholder: string;
}

const LanguageSheet: React.FC<LanguageSheetProps> = ({
    visible,
    onClose,
    selectedCode,
    onSelect,
    title,
    searchPlaceholder,
}) => {
    const { bottom } = useSafeAreaInsets();
    const { height: screenHeight } = Dimensions.get('window');
    const sheetHeight = Math.min(screenHeight * 0.85, 640);

    const translateY = useSharedValue(screenHeight);
    const backdropOpacity = useSharedValue(0);
    const [isRendering, setIsRendering] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (visible) {
            setIsRendering(true);
            setSearch('');
            translateY.value = withSpring(0, { damping: 20, stiffness: 90, mass: 0.8 });
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            translateY.value = withTiming(
                screenHeight,
                { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) },
                (finished) => {
                    if (finished) runOnJS(setIsRendering)(false);
                },
            );
            backdropOpacity.value = withTiming(0, { duration: 250 });
        }
    }, [visible, screenHeight]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const filtered = useMemo<LanguageOption[]>(() => {
        const query = search.trim().toLowerCase();
        if (!query) return LANGUAGES;
        return LANGUAGES.filter(
            (l) => l.name.toLowerCase().includes(query) || l.code.toLowerCase().includes(query),
        );
    }, [search]);

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

                    <View style={styles.searchWrapper}>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder={searchPlaceholder}
                            placeholderTextColor={colors.mutedText}
                            style={styles.searchInput}
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                    </View>

                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.code}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.flatListContent}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => {
                            const isActive = item.code === selectedCode;
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => onSelect(item.code)}
                                    style={styles.languageRow}
                                >
                                    <View style={styles.radioIndicatorWrapper}>
                                        {isActive ? (
                                            <View style={styles.radioSelectedOuter}>
                                                <View style={styles.radioSelectedInner} />
                                            </View>
                                        ) : (
                                            <View style={styles.radioUnselected} />
                                        )}
                                    </View>
                                    <Text style={styles.flag}>{languageToFlag(item.code)}</Text>
                                    <Text style={styles.languageName} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                    <Text style={styles.languageCode}>{item.code.toUpperCase()}</Text>
                                </TouchableOpacity>
                            );
                        }}
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

    const language = useLocaleStore((s) => s.language);
    const applySettings = useLocaleStore((s) => s.applySettings);

    // Local draft: user picks a language, then taps Apply to commit.
    const [draftLanguage, setDraftLanguage] = useState(language);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [applied, setApplied] = useState(false);

    // Keep draft in sync if the store changes externally (e.g. another screen).
    useEffect(() => {
        setDraftLanguage(language);
    }, [language]);

    const derivedLocale = useMemo(() => getLocaleFromLanguage(draftLanguage), [draftLanguage]);
    const selectedLanguage = useMemo<LanguageOption>(
        () => getLanguageByCode(draftLanguage) ?? { code: 'en', name: 'English' },
        [draftLanguage],
    );

    const handleBackPress = useCallback(() => {
        if (sheetVisible) {
            setSheetVisible(false);
            return true;
        }
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/settings' as any);
        }
        return true;
    }, [sheetVisible, router]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => backHandler.remove();
    }, [handleBackPress]);

    const handleApply = () => {
        applySettings(draftLanguage);
        setApplied(true);
    };

    const handleSelect = (code: string) => {
        setDraftLanguage(code);
        setApplied(false);
        setSheetVisible(false);
    };

    const hasChanges = draftLanguage !== language;

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar />

            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image source={ChevronLeftIcon} style={styles.fullImage} contentFit="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('locale.title')}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.formContainer}>
                    {/* Application Language */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>{t('locale.language')}</Text>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setSheetVisible(true)}
                            style={styles.selectTrigger}
                        >
                            <Text style={styles.flagInline}>{languageToFlag(selectedLanguage.code)}</Text>
                            <Text style={styles.selectValue} numberOfLines={1}>
                                {selectedLanguage.name}
                            </Text>
                            <View style={styles.arrowWrapper}>
                                <Image source={ArrowDownIcon} style={styles.fullImage} contentFit="contain" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Currency — auto-derived, read-only */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>{t('locale.currency')}</Text>
                        <View style={styles.readonlyField}>
                            <Text style={styles.selectValue}>{derivedLocale.currency}</Text>
                        </View>
                        <Text style={styles.autoDetectedLabel}>
                            {t('settings.auto_detected')}
                        </Text>
                    </View>

                    {/* Regional Format — auto-derived, read-only */}
                    <View style={styles.fieldWrapper}>
                        <Text style={styles.fieldLabel}>{t('locale.format')}</Text>
                        <View style={styles.readonlyField}>
                            <Text style={styles.selectValue}>{derivedLocale.dateFormat}</Text>
                        </View>
                        <Text style={styles.autoDetectedLabel}>
                            {t('settings.auto_detected')}
                        </Text>
                    </View>

                    <Text style={styles.disclaimer}>{t('settings.applies_sitewide')}</Text>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleApply}
                        disabled={!hasChanges && !applied}
                        style={[
                            styles.applyButton,
                            (!hasChanges && !applied) && styles.applyButtonDisabled,
                        ]}
                    >
                        <Text style={styles.applyButtonText}>
                            {applied && !hasChanges ? t('common.applied') : t('common.apply')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <LanguageSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                selectedCode={draftLanguage}
                onSelect={handleSelect}
                title={t('locale.language')}
                searchPlaceholder={`${t('common.search')} languages...`}
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
    headerTitle: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        color: colors.titleText,
        flex: 1,
        textAlign: 'center',
    },
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
        justifyContent: 'space-between',
        gap: 10,
    },
    readonlyField: {
        height: 56,
        backgroundColor: colors.bgCards,
        borderRadius: 16,
        paddingHorizontal: 17,
        justifyContent: 'center',
        opacity: 0.8,
    },
    autoDetectedLabel: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
        marginTop: -2,
    },
    flagInline: { fontSize: 20 },
    selectValue: { fontFamily: 'Manrope-Medium', fontSize: 16, color: colors.mutedText, flex: 1 },
    arrowWrapper: { width: 24, height: 24 },
    disclaimer: {
        fontFamily: 'Manrope-Regular',
        fontSize: 12,
        color: colors.mutedText,
        textAlign: 'center',
        marginTop: 8,
    },
    applyButton: {
        height: 56,
        backgroundColor: colors.primaryCTA,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButtonDisabled: { opacity: 0.4 },
    applyButtonText: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 16,
        color: colors.bg,
    },

    // Language sheet
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
        paddingHorizontal: 8,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    sheetTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: colors.titleText,
        textAlign: 'center',
        marginBottom: 12,
    },
    searchWrapper: { paddingHorizontal: 12, marginBottom: 8 },
    searchInput: {
        height: 44,
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
    },
    flatListContent: { paddingBottom: 20 },
    languageRow: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 10,
    },
    radioIndicatorWrapper: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    radioSelectedOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: colors.primaryCTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelectedInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primaryCTA },
    radioUnselected: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#444' },
    flag: { fontSize: 20 },
    languageName: {
        flex: 1,
        fontFamily: 'Manrope-Medium',
        fontSize: 15,
        color: colors.titleText,
    },
    languageCode: {
        fontFamily: 'Manrope-Regular',
        fontSize: 11,
        color: colors.mutedText,
    },
});
