import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { colors } from '@/constants/colors';
import { useWalletStore } from '@/store/walletStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');

export default function EditWalletNameScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const { name, activeGroupId, updateGroupName } = useWalletStore();
    const [walletName, setWalletName] = useState(name || '');
    const [isSaving, setIsSaving] = useState(false);

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [params.returnTo]);

    const handleBackPress = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/settings/accounts' as any);
        }
    };

    const handleSave = async () => {
        if (!walletName.trim()) {
            return;
        }

        setIsSaving(true);
        // Clean haptic on action start
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            if (activeGroupId) {
                updateGroupName(activeGroupId, walletName.trim());
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Navigate back
            router.back();
        } catch (error) {
            console.error('Failed to save wallet name:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <CustomStatusBar />

            {/* Header */}
            <View style={[styles.header, { paddingTop: top || 0 }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleBackPress}
                        style={styles.backButton}
                    >
                        <Image
                            source={ChevronLeftIcon}
                            style={styles.fullSize}
                            contentFit="contain"
                        />
                    </TouchableOpacity>

                    <ThemedText style={styles.headerTitle}>
                        Edit Wallet Name
                    </ThemedText>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={styles.content}>
                    <View style={styles.inputContainer}>
                        <ThemedText style={styles.inputLabel}>
                            Enter New Wallet Name
                        </ThemedText>

                        <View style={styles.inputWrapper}>
                            <TextInput
                                value={walletName}
                                onChangeText={setWalletName}
                                placeholder="New Wallet Name"
                                placeholderTextColor={colors.mutedText}
                                style={styles.textInput}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleSave}
                            />
                        </View>
                    </View>

                    <View style={[styles.footer, { bottom: (bottom || 16) + 32 }]}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleSave}
                            disabled={!walletName.trim() || isSaving}
                            style={[
                                styles.saveButton,
                                {
                                    backgroundColor: walletName.trim() && !isSaving
                                        ? colors.primaryCTA
                                        : colors.bgCards
                                }
                            ]}
                        >
                            <ThemedText
                                style={[
                                    styles.saveButtonText,
                                    {
                                        color: walletName.trim() && !isSaving
                                            ? colors.bg
                                            : colors.bodyText
                                    }
                                ]}
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 73,
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
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
        alignItems: 'center',
    },
    inputContainer: {
        width: '100%',
        maxWidth: 358,
        gap: 8,
    },
    inputLabel: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: colors.bodyText,
    },
    inputWrapper: {
        height: 64,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        paddingHorizontal: 17,
        justifyContent: 'center',
    },
    textInput: {
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        color: colors.titleText,
        width: '100%',
        paddingVertical: 10,
    },
    footer: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    saveButton: {
        width: '100%',
        maxWidth: 358,
        height: 54,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    saveButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
