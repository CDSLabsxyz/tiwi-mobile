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

import { useTranslation } from '@/hooks/useLocalization';

import { activityService } from '@/services/activityService';
import { useWalletStore } from '@/store/walletStore';

// Biometric icon
const FingerprintIcon = require('@/assets/security/fingerprint.svg');

export default function LockScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();
    const { unlockApp, isBiometricsEnabled, verifyPasscode: verifyStorePasscode } = useSecurityStore();
    const { address } = useWalletStore();
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

            // Log security activity
            if (address) {
                activityService.logSecurityEvent(
                    address,
                    'app_unlock',
                    'Security Alert',
                    'App was successfully unlocked with passcode.'
                );
            }

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
                promptMessage: t('lock.biometric_prompt'),
                fallbackLabel: 'Use Passcode',
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Log security activity
                if (address) {
                    activityService.logSecurityEvent(
                        address,
                        'biometric_unlock',
                        'Security Alert',
                        'App was successfully unlocked with biometrics.'
                    );
                }

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

                <Text style={styles.title}>{t('lock.welcome_back')}</Text>
                <Text style={styles.subtitle}>{t('lock.enter_passcode')}</Text>

                <View style={styles.dotsContainer}>
                    <PasscodeField length={6} passcode={code} isError={isError} />
                </View>

                {isError && (
                    <Text style={styles.errorText}>{t('lock.incorrect')}</Text>
                )}
            </View>

            <View style={{ paddingBottom: bottom }}>
                <SecurityKeypad
                    onPress={handlePress}
                    onDelete={handleDelete}
                    onBiometric={isBiometricsEnabled ? handleBiometric : undefined}
                    showBiometric={isBiometricsEnabled}
                    biometricIcon={true}
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
