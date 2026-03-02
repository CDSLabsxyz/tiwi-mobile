import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from '../../hooks/useLocalization';

// Settings Icons
const imgUserCircle = require('@/assets/settings/user-circle.svg');
const imgSecurityLock = require('@/assets/settings/security-lock.svg');
const imgPhoneDeveloperMode = require('@/assets/settings/phone-developer-mode.svg');
const imgLanguageSkill = require('@/assets/settings/language-skill.svg');
const imgNotification02 = require('@/assets/settings/notification-02.svg');
const imgDownload03 = require('@/assets/settings/download-03.svg');
const imgCustomerSupport = require('@/assets/settings/customer-support.svg');
const imgAddSquare = require('@/assets/settings/add-square.svg');
const imgCloudDownload = require('@/assets/settings/cloud-download.svg');

interface SettingsSection {
    id: string;
    title: string;
    icon: any;
    route?: string;
    onPress?: () => void;
}

const settingsSections: SettingsSection[] = [
    {
        id: 'account-details',
        title: 'Account Details',
        icon: imgUserCircle,
        route: '/settings/accounts',
    },
    {
        id: 'security',
        title: 'Security',
        icon: imgSecurityLock,
        route: '/settings/security',
    },
    {
        id: 'connected-devices',
        title: 'Connected Devices',
        icon: imgPhoneDeveloperMode,
        route: '/settings/connected-devices',
    },
    {
        id: 'language-region',
        title: 'Language & Region',
        icon: imgLanguageSkill,
        route: '/settings/language-region',
    },
    {
        id: 'notifications',
        title: 'Notifications',
        icon: imgNotification02,
        route: '/settings/notifications',
    },
    {
        id: 'app-updates-cache',
        title: 'App Updates & Cache',
        icon: imgDownload03,
        route: '/settings/app-updates-cache',
    },
    {
        id: 'support',
        title: 'Support',
        icon: imgCustomerSupport,
        route: '/settings/support',
    },
    {
        id: 'add-new-wallet',
        title: 'Add New Wallet',
        icon: imgAddSquare,
        route: '/wallet/create?mode=additional',
    },
    {
        id: 'import-wallet',
        title: 'Import Wallet',
        icon: imgCloudDownload,
        route: '/wallet/import?mode=additional',
    },
];

export default function SettingsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ returnTo?: string }>();
    const { t } = useTranslation();

    const translatedSections: SettingsSection[] = [
        {
            id: 'account-details',
            title: t('settings.account_details'),
            icon: imgUserCircle,
            route: '/settings/accounts',
        },
        {
            id: 'security',
            title: t('settings.security'),
            icon: imgSecurityLock,
            route: '/settings/security',
        },
        {
            id: 'connected-devices',
            title: t('settings.connected_devices'),
            icon: imgPhoneDeveloperMode,
            route: '/settings/connected-devices',
        },
        {
            id: 'language-region',
            title: t('settings.language_region'),
            icon: imgLanguageSkill,
            route: '/settings/language-region',
        },
        {
            id: 'notifications',
            title: t('settings.notifications'),
            icon: imgNotification02,
            route: '/settings/notifications',
        },
        {
            id: 'app-updates-cache',
            title: t('settings.app_updates_cache'),
            icon: imgDownload03,
            route: '/settings/app-updates-cache',
        },
        {
            id: 'support',
            title: t('settings.support'),
            icon: imgCustomerSupport,
            route: '/settings/support',
        },
        {
            id: 'add-new-wallet',
            title: t('settings.add_new_wallet'),
            icon: imgAddSquare,
            route: '/wallet/create?mode=additional',
        },
        {
            id: 'import-wallet',
            title: t('settings.import_wallet'),
            icon: imgCloudDownload,
            route: '/wallet/import?mode=additional',
        }
    ];

    // Handle phone back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPress();
            return true;
        });

        return () => backHandler.remove();
    }, [params.returnTo]);

    const handleBackPress = () => {
        if (params.returnTo) {
            router.push(params.returnTo as any);
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/' as any);
        }
    };

    const handleSectionPress = (section: SettingsSection) => {
        if (section.onPress) {
            section.onPress();
        } else if (section.route) {
            const returnRoute = params.returnTo || '/settings';
            const separator = section.route.includes('?') ? '&' : '?';
            router.push(`${section.route}${separator}returnTo=${encodeURIComponent(returnRoute)}` as any);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title={t('settings.title')} onBack={handleBackPress} showBack={true} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
            >
                <View style={styles.sectionsWrapper}>
                    {translatedSections.map((section) => (
                        <SettingsItem
                            key={section.id}
                            label={section.title}
                            icon={section.icon}
                            onPress={() => handleSectionPress(section)}
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
        paddingHorizontal: 18,
        paddingBottom: 40, // Reduced since tab bar is hidden
    },
    sectionsWrapper: {
        width: '100%',
        gap: 16,
    },
});
