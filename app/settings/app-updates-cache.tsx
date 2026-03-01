import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { colors } from '@/constants/colors';
import { BlurView } from 'expo-blur';
import { Paths, Directory, File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Assets
const DownloadIcon = require('../../assets/settings/download-03.svg');
const DeleteIcon = require('../../assets/settings/delete-02.svg');
const RestoreBinIcon = require('../../assets/settings/restore-bin.svg');
const RefreshIcon = require('../../assets/settings/refresh.svg');
const UnavailableIcon = require('../../assets/settings/unavailable.svg');

export default function AppUpdatesCacheScreen() {
    const { bottom } = useSafeAreaInsets();
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isResettingFiles, setIsResettingFiles] = useState(false);
    const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);

    const handleCheckForUpdates = async () => {
        try {
            if (Platform.OS === 'ios') {
                const appStoreUrl = 'https://apps.apple.com/app/tiwi-protocol/id123456789';
                await Linking.openURL(appStoreUrl);
            } else if (Platform.OS === 'android') {
                const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.tiwiprotocol.app';
                await Linking.openURL(playStoreUrl);
            } else {
                Alert.alert('Info', 'Please check for updates on your device app store');
            }
        } catch (error) {
            console.error('Error opening app store:', error);
            Alert.alert('Error', 'Failed to open app store');
        }
    };

    const handleClearCache = async () => {
        setIsClearingCache(true);
        try {
            const cacheDir = Paths.cache;
            if (cacheDir.exists) {
                const contents = cacheDir.list();
                for (const item of contents) {
                    item.delete();
                }
            }
            Alert.alert('Success', 'Cache cleared successfully');
        } catch (error) {
            console.error('Error clearing cache:', error);
            Alert.alert('Error', 'Failed to clear cache');
        } finally {
            setIsClearingCache(false);
        }
    };

    const handleResetTemporaryFiles = async () => {
        setIsResettingFiles(true);
        try {
            const cacheDir = Paths.cache;
            if (cacheDir.exists) {
                const contents = cacheDir.list();
                for (const item of contents) {
                    if (item.name.startsWith('temp_') || item.name.endsWith('.tmp')) {
                        item.delete();
                    }
                }
            }
            Alert.alert('Success', 'Temporary files reset successfully');
        } catch (error) {
            console.error('Error resetting temporary files:', error);
            Alert.alert('Error', 'Failed to reset temporary files');
        } finally {
            setIsResettingFiles(false);
        }
    };

    const handleRefreshNFTMetadata = async () => {
        setIsRefreshingMetadata(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            Alert.alert('Success', 'NFT metadata refreshed successfully');
        } finally {
            setIsRefreshingMetadata(false);
        }
    };

    const appUpdateOptions = [
        {
            id: 'check-updates',
            title: 'Check for Updates',
            icon: DownloadIcon,
            action: handleCheckForUpdates,
        },
        {
            id: 'clear-cache',
            title: 'Clear Cache',
            icon: DeleteIcon,
            action: handleClearCache,
            loading: isClearingCache,
        },
        {
            id: 'reset-temp-files',
            title: 'Reset Temporary Files',
            icon: RestoreBinIcon,
            action: handleResetTemporaryFiles,
            loading: isResettingFiles,
        },
        {
            id: 'refresh-nft-metadata',
            title: 'Refresh NFT Metadata',
            icon: RefreshIcon,
            action: handleRefreshNFTMetadata,
            loading: isRefreshingMetadata,
        },
        {
            id: 'developer-mode',
            title: 'Developer Mode',
            icon: UnavailableIcon,
            action: () => { },
            disabled: true,
        },
    ];

    return (
        <ThemedView style={styles.container}>
            <SettingsHeader title="App Updates & Cache" />

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
                    {appUpdateOptions.map((option) => (
                        <View key={option.id} style={styles.itemWrapper}>
                            <SettingsItem
                                label={option.title}
                                icon={option.icon}
                                onPress={option.disabled ? () => { } : option.action}
                                showChevron={!option.disabled && !option.loading}
                                rightElement={option.loading && <TIWILoader size={30} />}
                                destructive={false}
                            />
                            {option.disabled && (
                                <BlurView intensity={10} style={styles.blurOverlay} />
                            )}
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
    listWrapper: {
        gap: 16,
    },
    itemWrapper: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
    },
    blurOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
});
