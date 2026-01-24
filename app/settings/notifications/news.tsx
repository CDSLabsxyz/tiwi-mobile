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
    { id: 'tiwi-news', label: 'Tiwi Ecosystem News' },
    { id: 'new-listings', label: 'New Listings' },
    { id: 'partnership-announcements', label: 'Partnership Announcements' },
    { id: 'educational-content', label: 'Educational Content' },
    { id: 'marketing-promotions', label: 'Marketing Promotions' },
];

export default function NewsNotificationsScreen() {
    const { bottom } = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<Record<string, boolean>>({
        'tiwi-news': true,
        'new-listings': true,
        'partnership-announcements': true,
        'educational-content': false,
        'marketing-promotions': false,
    });

    const handleToggle = (id: string, value: boolean) => {
        setNotifications((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="News & Announcements" />

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
