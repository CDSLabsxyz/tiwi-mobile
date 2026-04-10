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
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as LocalAuthentication from 'expo-local-authentication';

import { useTranslation } from '@/hooks/useLocalization';

import { activityService } from '@/services/activityService';
import { useWalletStore } from '@/store/walletStore';


export default function LockScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();
    const { unlockApp, isBiometricsEnabled, isFaceUnlockEnabled, verifyPasscode: verifyStorePasscode } = useSecurityStore();
    const { address } = useWalletStore();
    const [code, setCode] = useState('');
    const [isError, setIsError] = useState(false);
    const [faceStatus, setFaceStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
    const [hasFaceID, setHasFaceID] = useState(false);
    const scanAnim = useRef(new Animated.Value(0)).current;

    // On Android: only fingerprint, no face unlock UI
    // On iOS: face unlock if available
    const isIOS = Platform.OS === 'ios';
    const biometricEnabled = isIOS
        ? (isBiometricsEnabled || isFaceUnlockEnabled)
        : isBiometricsEnabled;

    useEffect(() => {
        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
        return () => backHandler.remove();
    }, []);

    // Detect biometric type and auto-trigger on mount
    useEffect(() => {
        if (!biometricEnabled) return;

        let cancelled = false;
        const init = async () => {
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
                const supportsFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
                if (cancelled) return;
                // Only show face UI on iOS
                setHasFaceID(isIOS && supportsFace);

                // Auto-trigger only if the device actually has biometrics
                // enrolled — otherwise we'd loop on the prompt forever.
                if (hasHardware && isEnrolled) {
                    setTimeout(() => {
                        if (!cancelled) handleBiometric();
                    }, 300);
                }
            } catch {
                // Ignore detection errors
            }
        };

        init();
        return () => { cancelled = true; };
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

    const startScanAnimation = () => {
        scanAnim.setValue(0);
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(scanAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();
    };

    const handleBiometric = async () => {
        try {
            setFaceStatus('scanning');
            startScanAnimation();

            const promptMessage = hasFaceID ? 'Unlock with Face ID' : 'Unlock with Fingerprint';

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage,
                fallbackLabel: 'Use Passcode',
                // Don't fall back to the iOS device passcode — we have our own
                // in-app passcode UI right here on the lock screen.
                disableDeviceFallback: true,
                cancelLabel: 'Cancel',
            });

            scanAnim.stopAnimation();

            if (result.success) {
                setFaceStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                if (address) {
                    activityService.logSecurityEvent(
                        address,
                        hasFaceID ? 'face_unlock' : 'biometric_unlock',
                        'Security Alert',
                        `App was successfully unlocked with ${hasFaceID ? 'Face ID' : 'biometrics'}.`
                    );
                }

                setTimeout(() => {
                    unlockApp();
                    router.replace('/(tabs)');
                }, 400);
            } else {
                setFaceStatus('failed');
                setTimeout(() => setFaceStatus('idle'), 2000);
            }
        } catch (e) {
            console.log('Biometric error', e);
            setFaceStatus('failed');
            setTimeout(() => setFaceStatus('idle'), 2000);
        }
    };

    // Dynamic icon based on biometric type
    const getBiometricIcon = () => {
        if (faceStatus === 'success') return 'checkmark-circle';
        if (faceStatus === 'failed') return 'close-circle';
        return hasFaceID ? 'scan' : 'finger-print';
    };

    const getStatusText = () => {
        if (faceStatus === 'scanning') return hasFaceID ? 'Scanning face...' : 'Scanning...';
        if (faceStatus === 'success') return 'Verified';
        if (faceStatus === 'failed') return 'Not recognized';
        return hasFaceID ? 'Face ID' : 'Fingerprint';
    };

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            <View style={styles.content}>
                {/* Face unlock UI — iOS only */}
                {biometricEnabled && isIOS && hasFaceID && (
                    <TouchableOpacity onPress={handleBiometric} style={styles.faceIconContainer} activeOpacity={0.7}>
                        <Animated.View style={[
                            styles.faceIconRing,
                            faceStatus === 'scanning' && { borderColor: '#B1F128', opacity: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                            faceStatus === 'success' && { borderColor: '#B1F128' },
                            faceStatus === 'failed' && { borderColor: '#FF4D4D' },
                        ]}>
                            <Ionicons
                                name={getBiometricIcon() as any}
                                size={32}
                                color={faceStatus === 'success' ? '#B1F128' : faceStatus === 'failed' ? '#FF4D4D' : '#888'}
                            />
                        </Animated.View>
                        <Text style={[
                            styles.faceStatusText,
                            faceStatus === 'success' && { color: '#B1F128' },
                            faceStatus === 'failed' && { color: '#FF4D4D' },
                        ]}>
                            {getStatusText()}
                        </Text>
                    </TouchableOpacity>
                )}

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
                    onBiometric={biometricEnabled ? handleBiometric : undefined}
                    showBiometric={biometricEnabled}
                    biometricIcon={!hasFaceID}
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
        paddingHorizontal: 24,
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
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20
    },
    faceIconContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    faceIconRing: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    faceStatusText: {
        fontFamily: 'Manrope-Medium',
        fontSize: 12,
        color: '#888',
    },
    errorText: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: 'Manrope-Medium',
        color: '#FF4D4D',
        fontSize: 14,
    }
});
