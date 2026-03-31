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
import { Animated, BackHandler, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    const scanAnim = useRef(new Animated.Value(0)).current;

    const biometricEnabled = isBiometricsEnabled || isFaceUnlockEnabled;

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

    // Auto-trigger biometric/face unlock on mount
    useEffect(() => {
        if (biometricEnabled) {
            const timer = setTimeout(() => {
                handleBiometric();
            }, 400);
            return () => clearTimeout(timer);
        }
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

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: t('lock.biometric_prompt'),
                fallbackLabel: 'Use Passcode',
            });

            scanAnim.stopAnimation();

            if (result.success) {
                setFaceStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                if (address) {
                    activityService.logSecurityEvent(
                        address,
                        'biometric_unlock',
                        'Security Alert',
                        'App was successfully unlocked with biometrics.'
                    );
                }

                setTimeout(() => {
                    unlockApp();
                    router.replace('/(tabs)');
                }, 500);
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

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            <View style={styles.content}>
                {biometricEnabled && (
                    <TouchableOpacity onPress={handleBiometric} style={styles.faceIconContainer} activeOpacity={0.7}>
                        <Animated.View style={[
                            styles.faceIconRing,
                            faceStatus === 'scanning' && { borderColor: '#B1F128', opacity: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                            faceStatus === 'success' && { borderColor: '#B1F128' },
                            faceStatus === 'failed' && { borderColor: '#FF4D4D' },
                        ]}>
                            <Ionicons
                                name={faceStatus === 'success' ? 'checkmark-circle' : faceStatus === 'failed' ? 'close-circle' : 'scan-outline'}
                                size={32}
                                color={faceStatus === 'success' ? '#B1F128' : faceStatus === 'failed' ? '#FF4D4D' : '#888'}
                            />
                        </Animated.View>
                        <Text style={[
                            styles.faceStatusText,
                            faceStatus === 'success' && { color: '#B1F128' },
                            faceStatus === 'failed' && { color: '#FF4D4D' },
                        ]}>
                            {faceStatus === 'scanning' ? 'Scanning...' : faceStatus === 'success' ? 'Verified' : faceStatus === 'failed' ? 'Not recognized' : 'Tap to unlock'}
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
