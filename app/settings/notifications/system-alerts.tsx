import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NotificationOption {
    id: string;
    label: string;
}

const notificationOptions: NotificationOption[] = [
    { id: 'security-alerts', label: 'Security Alerts' },
    { id: 'app-updates', label: 'App Updates' },
    { id: 'account-activity', label: 'Account Activity' },
    { id: 'new-feature-alerts', label: 'New Feature Alerts' },
    { id: 'service-outages', label: 'Service Outages' },
];

export default function SystemAlertsNotificationsScreen() {
    const { bottom } = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<Record<string, boolean>>({
        'security-alerts': true,
        'app-updates': true,
        'account-activity': true,
        'new-feature-alerts': true,
        'service-outages': true,
    });

    const handleToggle = (id: string, value: boolean) => {
        setNotifications((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="System Alerts" />

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
                    {notificationOptions.map((option) => (
                        <View key={option.id} style={styles.listItem}>
                            <ThemedText style={styles.itemLabel}>
                                {option.label}
                            </ThemedText>
                            <ToggleSwitch
                                value={notifications[option.id] || false}
                                onValueChange={(value) => handleToggle(option.id, value)}
                            />
                        </View>
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
        paddingTop: 40,
        paddingHorizontal: 20,
    },
    listContainer: {
        gap: 16,
    },
    listItem: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemLabel: {
        fontSize: 16,
        opacity: 0.9,
    },
});
