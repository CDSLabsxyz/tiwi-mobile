/**
 * Lock Screen
 * Security checkpoint for returning users.
 * Requires passcode input to unlock the app.
 */

import { PasscodeField } from '@/components/ui/security/PasscodeField';
import { SecurityKeypad } from '@/components/ui/security/SecurityKeypad';
import { useSecurityStore } from '@/store/securityStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as LocalAuthentication from 'expo-local-authentication';

// Biometric icon
const FingerprintIcon = require('@/assets/security/fingerprint.svg');

export default function LockScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { unlockApp, isBiometricsEnabled, verifyPasscode: verifyStorePasscode } = useSecurityStore();
    const [code, setCode] = useState('');
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        // Prevent going back
        const backAction = () => {
            return true;
        };
        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            backAction
        );
        return () => backHandler.remove();
    }, []);

    const handlePress = (digit: string) => {
        if (isError) return;
        if (code.length < 6) {
            const newCode = code + digit;
            setCode(newCode);

            if (newCode.length === 6) {
                handleVerify(newCode);
            }
        }
    };

    const handleVerify = async (inputCode: string) => {
        const isValid = await verifyStorePasscode(inputCode);
        if (isValid) {
            // Success
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            unlockApp();
            router.replace('/(tabs)');
        } else {
            // Error
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setIsError(true);
            setTimeout(() => {
                setCode('');
                setIsError(false);
            }, 1500);
        }
    };

    const handleDelete = () => {
        if (code.length > 0) {
            setCode(code.slice(0, -1));
            setIsError(false);
        }
    };

    const handleBiometric = async () => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock with Fingerprint',
                fallbackLabel: 'Use Passcode',
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                unlockApp();
                router.replace('/(tabs)');
            }
        } catch (e) {
            console.log('Biometric error', e);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            <View style={styles.content}>
                {/* Logo or Icon could go here */}

                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Enter your passcode to unlock</Text>

                <View style={styles.dotsContainer}>
                    <PasscodeField length={6} passcode={code} isError={isError} />
                </View>

                {isError && (
                    <Text style={styles.errorText}>Incorrect passcode</Text>
                )}
            </View>

            <View style={{ paddingBottom: bottom }}>
                <SecurityKeypad
                    onPress={handlePress}
                    onDelete={handleDelete}
                    onBiometric={isBiometricsEnabled ? handleBiometric : undefined}
                    showBiometric={isBiometricsEnabled}
                    biometricIcon={FingerprintIcon}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    title: {
        fontFamily: 'Manrope-Bold',
        fontSize: 24,
        color: '#FFFFFF',
        marginBottom: 12,
    },
    subtitle: {
        fontFamily: 'Manrope-Regular',
        fontSize: 16,
        color: '#B5B5B5',
        marginBottom: 48,
    },
    dotsContainer: {
        marginBottom: 20
    },
    errorText: {
        position: 'absolute',
        bottom: 40,
        fontFamily: 'Manrope-Medium',
        color: '#FF4D4D',
        fontSize: 14,
    }
});
