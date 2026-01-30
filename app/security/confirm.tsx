/**
 * Confirm Passcode Screen
 * User verifies the 6-digit passcode
 */

import { PasscodeField } from '@/components/ui/security/PasscodeField';
import { SecurityKeypad } from '@/components/ui/security/SecurityKeypad';
import { colors } from '@/constants/colors';
import { useSecurityStore } from '@/store/securityStore';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ConfirmPasscodeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams();
    const tempCode = params.tempCode as string;

    const [code, setCode] = useState('');
    const [isError, setIsError] = useState(false);
    const setPasscode = useSecurityStore((state) => state.setPasscode);

    const handlePress = (digit: string) => {
        if (isError) return; // Wait for reset
        if (code.length < 6) {
            const newCode = code + digit;
            setCode(newCode);

            if (newCode.length === 6) {
                if (newCode === tempCode) {
                    // Success
                    setPasscode(newCode, true); // Set to true to indicate passcode exists
                    setTimeout(() => {
                        router.push('/security/biometrics');
                    }, 100);
                } else {
                    // No match
                    setIsError(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

                    setTimeout(() => {
                        setIsError(false);
                        setCode('');
                    }, 2000);
                }
            }
        }
    };

    const handleDelete = () => {
        if (code.length > 0) {
            setCode(code.slice(0, -1));
        }
    };

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Passcode</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>Confirm Passcode</Text>
                <Text style={styles.subtitle}>
                    Please re-enter the new passcode to confirm your choice
                </Text>

                <View style={styles.dotsContainer}>
                    <PasscodeField length={6} passcode={code} isError={isError} />
                </View>

                {isError && (
                    <Text style={styles.errorText}>
                        Passcodes do not match. Please try again.
                    </Text>
                )}
            </View>

            <View style={{ paddingBottom: bottom }}>
                <SecurityKeypad
                    onPress={handlePress}
                    onDelete={handleDelete}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontFamily: 'Manrope-SemiBold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        marginTop: -40,
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
        textAlign: 'center',
        marginBottom: 48,
        lineHeight: 24,
        maxWidth: 280,
    },
    dotsContainer: {
        marginBottom: 20
    },
    errorText: {
        color: colors.error,
        fontFamily: 'Manrope-Medium',
        fontSize: 14,
        marginTop: 8,
    }
});
