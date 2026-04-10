import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Security Icons
const ResetPasswordIcon = require('@/assets/settings/reset-password.svg');
const BiometricAccessIcon = require('@/assets/settings/biometric-access.svg');
const FaceUnlockIcon = require('@/assets/settings/user-circle.svg');
const Timer02Icon = require('@/assets/settings/timer-02.svg');
const AlertSquareIcon = require('@/assets/settings/alert-square.svg');

import { useSecurityStore } from '@/store/securityStore';
import * as Haptics from 'expo-haptics';

export default function SecuritySettingsScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const { isBiometricsEnabled, enableBiometrics, isFaceUnlockEnabled, enableFaceUnlock } = useSecurityStore();

    const handleToggleFaceUnlock = (value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        enableFaceUnlock(value);
    };

    const handleToggleBiometrics = (value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        enableBiometrics(value);
    };

    const securityItems = [
        { label: 'Change PIN', icon: ResetPasswordIcon, route: '/settings/security/change-pin' },
        // Face Unlock — iOS only (Android uses system fingerprint)
        ...(Platform.OS === 'ios' ? [{
            label: 'Face Unlock',
            icon: FaceUnlockIcon,
            rightElement: <ToggleSwitch value={isFaceUnlockEnabled} onValueChange={handleToggleFaceUnlock} />,
            showChevron: false
        }] : []),
        {
            label: 'Enable/Disable Biometrics',
            icon: BiometricAccessIcon,
            rightElement: <ToggleSwitch value={isBiometricsEnabled} onValueChange={handleToggleBiometrics} />,
            showChevron: false
        },
        { label: 'Auto-Lock Timer', icon: Timer02Icon, route: '/settings/security/auto-lock-timer' },
        { label: 'Fraud Alerts & Activity', icon: AlertSquareIcon, route: '/settings/security/fraud-alerts' },
    ];

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Security" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
            >
                <View style={styles.listContainer}>
                    {securityItems.map((item, index) => (
                        <SettingsItem
                            key={index}
                            label={item.label}
                            icon={item.icon}
                            onPress={() => item.route && router.push(item.route as any)}
                            rightElement={item.rightElement}
                            showChevron={item.showChevron}
                        />
                    ))}
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: 24,
        paddingHorizontal: 20,
    },
    listContainer: {
        gap: 24,
    },
});
