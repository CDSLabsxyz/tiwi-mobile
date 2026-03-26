import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

interface NotificationOption {
    id: string;
    label: string;
}

const notificationOptions: NotificationOption[] = [
    { id: 'swap-completed', label: 'Swap Completed' },
    { id: 'received-payment', label: 'Received Payment' },
    { id: 'failed-transactions', label: 'Failed Transactions' },
    { id: 'on-chain-confirmations', label: 'On-chain confirmations' },
];

export default function TransactionsNotificationsScreen() {
    const { bottom } = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<Record<string, boolean>>({
        'swap-completed': true,
        'received-payment': true,
        'failed-transactions': true,
        'on-chain-confirmations': true,
    });

    const handleToggle = async (id: string, value: boolean) => {
        setNotifications((prev) => ({
            ...prev,
            [id]: value,
        }));

        if (value) {
            let title = '';
            let body = '';

            switch (id) {
                case 'swap-completed':
                    title = 'Swap Completed 🔄';
                    body = 'Your swap to USDC was successful.';
                    break;
                case 'received-payment':
                    title = 'Payment Received 💰';
                    body = 'You just received 500 TWC in your wallet.';
                    break;
                case 'failed-transactions':
                    title = 'Transaction Failed ⚠️';
                    body = 'Your previous transaction was reverted by the network.';
                    break;
                case 'on-chain-confirmations':
                    title = 'Network Confirmed 🔗';
                    body = 'Your recent transaction has been confirmed on the blockchain.';
                    break;
            }

            if (title) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: title,
                        body: body,
                        sound: true,
                        data: { type: id }
                    },
                    trigger: null, // Trigger immediately as a sample 
                });
            }
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Transactions Notifications" />

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
