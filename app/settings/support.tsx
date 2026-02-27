import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Assets
const LiveStreamingIcon = require('@/assets/settings/live-streaming-01.svg');
const HelpSquareIcon = require('@/assets/settings/help-square.svg');
const ComputerVideoIcon = require('@/assets/settings/computer-video.svg');
const ComplaintIcon = require('@/assets/settings/complaint.svg');
const CustomerSupportIcon = require('@/assets/settings/customer-support.svg');

interface SupportOption {
    id: string;
    title: string;
    icon: any;
    route: string;
}

const supportOptions: SupportOption[] = [
    {
        id: 'live-status',
        title: 'Live Status',
        icon: LiveStreamingIcon,
        route: '/settings/support/live-status',
    },
    {
        id: 'faqs',
        title: 'FAQs',
        icon: HelpSquareIcon,
        route: '/settings/support/faqs',
    },
    {
        id: 'tutorials',
        title: 'Tutorials',
        icon: ComputerVideoIcon,
        route: '/settings/support/tutorials',
    },
    {
        id: 'report-bug',
        title: 'Report a Bug',
        icon: ComplaintIcon,
        route: '/settings/support/report-bug',
    },
    {
        id: 'contact-support',
        title: 'Contact Support',
        icon: CustomerSupportIcon,
        route: '/settings/support/contact-support',
    },
];

export default function SupportScreen() {
    const { bottom } = useSafeAreaInsets();
    const router = useRouter();

    const handleOptionPress = (option: SupportOption) => {
        router.push(option.route as any);
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="Support" />

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
                    {supportOptions.map((option) => (
                        <SettingsItem
                            key={option.id}
                            label={option.title}
                            icon={option.icon}
                            onPress={() => handleOptionPress(option)}
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
