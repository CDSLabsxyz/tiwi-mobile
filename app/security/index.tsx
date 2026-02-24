/**
 * Create Passcode Screen
 * User sets a new 6-digit passcode
 */

import { PasscodeField } from '@/components/ui/security/PasscodeField';
import { SecurityKeypad } from '@/components/ui/security/SecurityKeypad';
import { useSecurityStore } from '@/store/securityStore';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Use a simple back button header instead of the main app header if needed
import Feather from '@expo/vector-icons/Feather';
import { TouchableOpacity } from 'react-native';

export default function CreatePasscodeScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter(); // Use local router
    const [code, setCode] = useState('');
    const { setSetupPhase } = useSecurityStore();

    const handlePress = (digit: string) => {
        if (code.length < 6) {
            const newCode = code + digit;
            setCode(newCode);

            if (newCode.length === 6) {
                // Navigate to confirm
                setTimeout(() => {
                    // Pass the code to the next screen via query params or a temporary store
                    // Ideally use params
                    router.push({ pathname: '/security/confirm', params: { tempCode: newCode } });
                }, 100);
            }
        }
    };

    const handleDelete = () => {
        if (code.length > 0) {
            setCode(code.slice(0, -1));
        }
    };

    const handleBack = () => {
        // Reset setup phase so the navigation guard allows going back to welcome
        setSetupPhase('WELCOME');
        router.replace('/welcome' as any);
    };

    return (
        <View style={[styles.container, { paddingTop: top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Passcode</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>Create Passcode</Text>
                <Text style={[styles.subtitle, { paddingHorizontal: 24 }]}>
                    Secure your wallet with a strong passcode you’ll remember
                </Text>

                <View style={styles.dotsContainer}>
                    <PasscodeField length={6} passcode={code} />
                </View>
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
        textAlign: 'center',
        marginBottom: 48,
        lineHeight: 24,
    },
    dotsContainer: {
        marginBottom: 20
    }
});
