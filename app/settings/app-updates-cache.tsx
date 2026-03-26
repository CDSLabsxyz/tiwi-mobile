import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { colors } from '@/constants/colors';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
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

export default function AppUpdatesCacheScreen() {
    const { bottom } = useSafeAreaInsets();
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isResettingFiles, setIsResettingFiles] = useState(false);

    const handleCheckForUpdates = async () => {
        try {
            await Linking.openURL('https://app.tiwiprotocol.xyz/download');
        } catch (error) {
            console.error('Error opening update link:', error);
            Alert.alert('Error', 'Failed to open update link');
        }
    };

    const handleClearCache = async () => {
        setIsClearingCache(true);
        try {
            const cacheDir = FileSystem.cacheDirectory;
            if (cacheDir) {
                const dirInfo = await FileSystem.getInfoAsync(cacheDir);
                if (dirInfo.exists) {
                    const contents = await FileSystem.readDirectoryAsync(cacheDir);
                    for (const item of contents) {
                        try {
                            await FileSystem.deleteAsync(`${cacheDir}${item}`, { idempotent: true });
                        } catch (e) {
                            console.warn('Skipped non-deletable sub-item in cache:', item);
                        }
                    }
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
            const cacheDir = FileSystem.cacheDirectory;
            if (cacheDir) {
                const dirInfo = await FileSystem.getInfoAsync(cacheDir);
                if (dirInfo.exists) {
                    const contents = await FileSystem.readDirectoryAsync(cacheDir);
                    for (const item of contents) {
                        if (item.startsWith('temp_') || item.endsWith('.tmp') || item.includes('tmp')) {
                            try {
                                await FileSystem.deleteAsync(`${cacheDir}${item}`, { idempotent: true });
                            } catch (e) {
                                console.warn('Skipped non-deletable tmp file:', item);
                            }
                        }
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
                                onPress={option.action}
                                showChevron={!option.loading}
                                rightElement={option.loading && <TIWILoader size={30} />}
                                destructive={false}
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
