import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { colors } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChangePinScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    const handleConfirm = () => {
        if (newPin === confirmPin && newPin.length >= 6) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
        }
    };

    const isFormValid = currentPin.length >= 6 && newPin.length >= 6 && confirmPin.length >= 6 && newPin === confirmPin;

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Change Pin" />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.inputList}>
                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>Enter current PIN</ThemedText>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    value={currentPin}
                                    onChangeText={setCurrentPin}
                                    placeholder="******"
                                    placeholderTextColor={colors.mutedText}
                                    secureTextEntry
                                    maxLength={6}
                                    keyboardType="number-pad"
                                    style={styles.input}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>Set new PIN</ThemedText>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    value={newPin}
                                    onChangeText={setNewPin}
                                    placeholder="******"
                                    placeholderTextColor={colors.mutedText}
                                    secureTextEntry
                                    maxLength={6}
                                    keyboardType="number-pad"
                                    style={styles.input}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>Confirm new PIN</ThemedText>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    value={confirmPin}
                                    onChangeText={setConfirmPin}
                                    placeholder="******"
                                    placeholderTextColor={colors.mutedText}
                                    secureTextEntry
                                    maxLength={6}
                                    keyboardType="number-pad"
                                    style={styles.input}
                                />
                            </View>
                        </View>
                    </View>

                    <View style={[styles.footer, { marginBottom: (bottom || 16) + 20 }]}>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleConfirm}
                            disabled={!isFormValid}
                            style={[
                                styles.confirmButton,
                                { backgroundColor: isFormValid ? colors.primaryCTA : colors.bgCards }
                            ]}
                        >
                            <ThemedText
                                style={[
                                    styles.confirmButtonText,
                                    { color: isFormValid ? '#050201' : colors.bodyText }
                                ]}
                            >
                                Confirm
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
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 18,
        paddingTop: 40,
    },
    inputList: {
        gap: 24,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        opacity: 0.7,
    },
    inputWrapper: {
        height: 64,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    input: {
        color: '#FFFFFF',
        fontSize: 20,
        letterSpacing: 4,
        height: '100%',
    },
    footer: {
        marginTop: 'auto',
        alignItems: 'center',
    },
    confirmButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
