import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Assets
const TransactionHistoryIcon = require('../../assets/home/transaction-history.svg');
const CrownIcon = require('../../assets/settings/crown.svg');
const UserGroupIcon = require('../../assets/settings/user-group-02.svg');
const NewsIcon = require('../../assets/settings/news-01.svg');
const AlertCircleIcon = require('../../assets/settings/alert-circle.svg');

interface NotificationCategory {
    id: string;
    title: string;
    icon: any;
    route: string;
}

const notificationCategories: NotificationCategory[] = [
    {
        id: 'transactions',
        title: 'Transactions',
        icon: TransactionHistoryIcon,
        route: '/settings/notifications/transactions',
    },
    {
        id: 'rewards-earnings',
        title: 'Rewards & Earnings',
        icon: CrownIcon,
        route: '/settings/notifications/rewards-earnings',
    },
    {
        id: 'governance',
        title: 'Governance',
        icon: UserGroupIcon,
        route: '/settings/notifications/governance',
    },
    {
        id: 'news',
        title: 'News & Announcements',
        icon: NewsIcon,
        route: '/settings/notifications/news',
    },
    {
        id: 'system-alerts',
        title: 'System Alerts',
        icon: AlertCircleIcon,
        route: '/settings/notifications/system-alerts',
    },
];

export default function NotificationsScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Notifications" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: (bottom || 16) + 24 }
                ]}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
            >
                <View style={styles.listWrapper}>
                    {notificationCategories.map((category) => (
                        <SettingsItem
                            key={category.id}
                            label={category.title}
                            icon={category.icon}
                            onPress={() => router.push(category.route as any)}
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
        paddingTop: 40,
        paddingHorizontal: 20,
    },
    listWrapper: {
        gap: 20,
    },
});
