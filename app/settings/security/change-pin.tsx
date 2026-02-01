import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { useSecurityStore } from '@/store/securityStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChevronLeftIcon = require('../../../assets/swap/arrow-left-02.svg');

export default function ChangePinScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { verifyPasscode, setPasscode } = useSecurityStore();

    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, []);

    const handleBackPress = () => {
        router.back();
    };

    const handleConfirm = async () => {
        setIsVerifying(true);
        setError(null);

        try {
            // 1. Verify Current PIN
            const isCurrentValid = await verifyPasscode(currentPin);
            if (!isCurrentValid) {
                setError('Current PIN is incorrect');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setIsVerifying(false);
                return;
            }

            // 2. Safety Check: New PIN must be different
            if (newPin === currentPin) {
                setError('New PIN must be different from current PIN');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setIsVerifying(false);
                return;
            }

            // 3. Confirm Match
            if (newPin !== confirmPin) {
                setError('New PINs do not match');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setIsVerifying(false);
                return;
            }

            // 4. Update Global Security
            await setPasscode(newPin, true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
        } catch (e) {
            setError('An error occurred. Please try again.');
            setIsVerifying(false);
        }
    };

    const isFormValid = currentPin.length === 6 && newPin.length === 6 && confirmPin.length === 6;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
                        Change Pin
                    </Text>
                    <View style={styles.placeholder} />
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.inputContainer}>
                    {/* Enter current PIN */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Enter current PIN</Text>
                        <View style={styles.textInputWrapper}>
                            <TextInput
                                value={currentPin}
                                onChangeText={setCurrentPin}
                                placeholder="******"
                                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                secureTextEntry
                                maxLength={6}
                                keyboardType="number-pad"
                                style={styles.textInput}
                            />
                        </View>
                    </View>

                    {/* Set new PIN */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Set new PIN</Text>
                        <View style={styles.textInputWrapper}>
                            <TextInput
                                value={newPin}
                                onChangeText={setNewPin}
                                placeholder="******"
                                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                secureTextEntry
                                maxLength={6}
                                keyboardType="number-pad"
                                style={styles.textInput}
                            />
                        </View>
                    </View>

                    {/* Confirm new PIN */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm new PIN</Text>
                        <View style={styles.textInputWrapper}>
                            <TextInput
                                value={confirmPin}
                                onChangeText={setConfirmPin}
                                placeholder="******"
                                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                secureTextEntry
                                maxLength={6}
                                keyboardType="number-pad"
                                style={styles.textInput}
                            />
                        </View>
                    </View>

                    {error && (
                        <Text style={styles.errorText}>{error}</Text>
                    )}
                </View>
            </View>

            {/* Confirm Button */}
            <View style={[styles.footer, { paddingBottom: (bottom || 16) + 24 }]}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleConfirm}
                    disabled={!isFormValid || isVerifying}
                    style={[
                        styles.confirmButton,
                        { backgroundColor: isFormValid ? '#B4FF3B' : 'rgba(255, 255, 255, 0.05)' }
                    ]}
                >
                    <Text style={[
                        styles.confirmButtonText,
                        { color: isFormValid ? '#050201' : 'rgba(255, 255, 255, 0.3)' }
                    ]}>
                        {isVerifying ? 'Verifying...' : 'Confirm'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050201',
    },
    header: {
        backgroundColor: '#050201',
        paddingHorizontal: 18,
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
        paddingTop: 60,
    },
    inputContainer: {
        gap: 16,
        width: '100%',
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontFamily: 'Manrope-Regular',
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    textInputWrapper: {
        height: 64,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 17,
        justifyContent: 'center',
    },
    textInput: {
        fontFamily: 'Manrope-Medium',
        fontSize: 20,
        color: '#FFFFFF',
        width: '100%',
        letterSpacing: 4,
    },
    errorText: {
        color: '#FF4B4B',
        fontSize: 14,
        fontFamily: 'Manrope-Medium',
        textAlign: 'center',
        marginTop: 8,
    },
    footer: {
        paddingHorizontal: 18,
        alignItems: 'center',
    },
    confirmButton: {
        width: '100%',
        height: 54,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 16,
    },
    fullSize: {
        width: '100%',
        height: '100%',
    },
});
