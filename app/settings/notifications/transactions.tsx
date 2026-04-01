import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STORAGE_KEY = 'tiwi_notification_prefs';

interface NotificationOption {
    id: string;
    label: string;
}

const notificationOptions: NotificationOption[] = [
    { id: 'swap', label: 'Swap Completed' },
    { id: 'received', label: 'Received Payment' },
    { id: 'failed', label: 'Failed Transactions' },
    { id: 'confirmed', label: 'On-chain confirmations' },
];

export default function TransactionsNotificationsScreen() {
    const { bottom } = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<Record<string, boolean>>({
        swap: true,
        received: true,
        failed: true,
        confirmed: true,
    });

    // Load persisted settings
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then(val => {
            if (val) {
                try { setNotifications(JSON.parse(val)); } catch {}
            }
        });
    }, []);

    const handleToggle = async (id: string, value: boolean) => {
        const updated = { ...notifications, [id]: value };
        setNotifications(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Transactions Notifications" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: (bottom || 16) + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.listContainer}>
                    {notificationOptions.map((option) => (
                        <View key={option.id} style={styles.listItem}>
                            <ThemedText style={styles.itemLabel}>{option.label}</ThemedText>
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
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingTop: 40, paddingHorizontal: 20 },
    listContainer: { gap: 16 },
    listItem: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemLabel: { fontSize: 16, opacity: 0.9 },
});
