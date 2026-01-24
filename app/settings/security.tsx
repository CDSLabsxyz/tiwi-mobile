import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Security Icons
const ResetPasswordIcon = require('../../assets/settings/reset-password.svg');
const BiometricAccessIcon = require('../../assets/settings/biometric-access.svg');
const Timer02Icon = require('../../assets/settings/timer-02.svg');
const AlertSquareIcon = require('../../assets/wallet/alert-square.svg');
const AddressBookIcon = require('../../assets/settings/address-book.svg');

export default function SecuritySettingsScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();
    const [biometricsEnabled, setBiometricsEnabled] = useState(true);

    const securityItems = [
        { label: 'Change PIN', icon: ResetPasswordIcon, route: '/settings/security/change-pin' },
        {
            label: 'Enable/Disable Biometrics',
            icon: BiometricAccessIcon,
            rightElement: <ToggleSwitch value={biometricsEnabled} onValueChange={setBiometricsEnabled} />,
            showChevron: false
        },
        { label: 'Auto-Lock Timer', icon: Timer02Icon, route: '/settings/security/auto-lock-timer' },
        { label: 'Fraud Alerts & Activity', icon: AlertSquareIcon, route: '/settings/security/fraud-alerts' },
        { label: 'Whitelist Addresses', icon: AddressBookIcon, route: '/settings/security/whitelist-addresses' },
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
