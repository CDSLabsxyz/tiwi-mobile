import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SettingsHeader } from '@/components/ui/settings-header';
import { SettingsItem } from '@/components/ui/settings-item';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateService, UpdateStatus, VersionInfo } from '@/services/updateService';

// Assets
const DownloadIcon = require('../../assets/settings/download-03.svg');
const DeleteIcon = require('../../assets/settings/delete-02.svg');
const RestoreBinIcon = require('../../assets/settings/restore-bin.svg');

const AUTO_UPDATE_KEY = '@tiwi/auto-update-enabled';

export default function AppUpdatesCacheScreen() {
    const { bottom } = useSafeAreaInsets();
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isResettingFiles, setIsResettingFiles] = useState(false);
    const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null);
    const [updateError, setUpdateError] = useState<string | undefined>();

    // Load auto-update preference
    useEffect(() => {
        AsyncStorage.getItem(AUTO_UPDATE_KEY).then((value) => {
            if (value !== null) setAutoUpdateEnabled(value === 'true');
        });
    }, []);

    // Subscribe to update service status
    useEffect(() => {
        const unsubscribe = updateService.subscribe((status, progress, versionInfo, error) => {
            setUpdateStatus(status);
            setDownloadProgress(progress ?? 0);
            setLatestVersion(versionInfo ?? null);
            setUpdateError(error);
        });
        return unsubscribe;
    }, []);

    const handleToggleAutoUpdate = async (value: boolean) => {
        setAutoUpdateEnabled(value);
        await AsyncStorage.setItem(AUTO_UPDATE_KEY, value.toString());
    };

    const handleCheckForUpdates = useCallback(async () => {
        if (Platform.OS !== 'android') {
            Alert.alert('Info', 'Auto-updates are only available for Android APK builds.');
            return;
        }

        const update = await updateService.checkForUpdate();

        if (!update) {
            if (updateStatus !== 'error') {
                Alert.alert(
                    'Up to Date',
                    `You're running the latest version (${updateService.getCurrentVersion()}).`
                );
            }
            return;
        }

        // Update found — start download automatically
        const uri = await updateService.downloadUpdate();
        if (uri) {
            await updateService.installUpdate();
        }
    }, [updateStatus]);

    const handleRetryInstall = useCallback(async () => {
        await updateService.installUpdate();
    }, []);

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

    const isUpdateBusy = updateStatus === 'checking' || updateStatus === 'downloading' || updateStatus === 'installing';

    const getUpdateStatusText = (): string => {
        switch (updateStatus) {
            case 'checking': return 'Checking for updates...';
            case 'downloading': return `Downloading update... ${downloadProgress}%`;
            case 'ready-to-install': return 'Update ready — tap to install';
            case 'installing': return 'Opening installer...';
            case 'update-available': return `Version ${latestVersion?.version} available`;
            case 'no-update': return `You're on the latest version`;
            case 'error': return updateError || 'Update check failed';
            default: return '';
        }
    };

    const getCheckButtonLabel = (): string => {
        if (updateStatus === 'ready-to-install') return 'Install Update';
        if (isUpdateBusy) return 'Checking...';
        return 'Check for Updates';
    };

    const handleUpdatePress = () => {
        if (updateStatus === 'ready-to-install') {
            handleRetryInstall();
        } else if (!isUpdateBusy) {
            handleCheckForUpdates();
        }
    };

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
                {/* Version Info */}
                <View style={styles.versionCard}>
                    <ThemedText style={styles.versionLabel}>Current Version</ThemedText>
                    <ThemedText style={styles.versionNumber}>
                        {updateService.getCurrentVersion()}
                    </ThemedText>
                </View>

                {/* Auto-Update Toggle */}
                {Platform.OS === 'android' && (
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleTextContainer}>
                            <ThemedText style={styles.toggleTitle}>Auto-Update</ThemedText>
                            <ThemedText style={styles.toggleSubtitle}>
                                Automatically check and download updates on launch
                            </ThemedText>
                        </View>
                        <Switch
                            value={autoUpdateEnabled}
                            onValueChange={handleToggleAutoUpdate}
                            trackColor={{ false: colors.bgStroke, true: colors.primaryCTA }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                )}

                {/* Update Status */}
                {updateStatus !== 'idle' && (
                    <View style={styles.statusCard}>
                        {(updateStatus === 'downloading') && (
                            <View style={styles.progressBarContainer}>
                                <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
                            </View>
                        )}
                        <ThemedText style={[
                            styles.statusText,
                            updateStatus === 'error' && { color: colors.error },
                            updateStatus === 'no-update' && { color: colors.success },
                            updateStatus === 'ready-to-install' && { color: colors.primaryCTA },
                        ]}>
                            {getUpdateStatusText()}
                        </ThemedText>
                        {latestVersion?.releaseNotes && updateStatus === 'update-available' && (
                            <ThemedText style={styles.releaseNotes}>
                                {latestVersion.releaseNotes}
                            </ThemedText>
                        )}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.listWrapper}>
                    <View style={styles.itemWrapper}>
                        <SettingsItem
                            label={getCheckButtonLabel()}
                            icon={DownloadIcon}
                            onPress={handleUpdatePress}
                            showChevron={!isUpdateBusy}
                            rightElement={isUpdateBusy ? <TIWILoader size={30} /> : undefined}
                        />
                    </View>

                    <View style={styles.itemWrapper}>
                        <SettingsItem
                            label="Clear Cache"
                            icon={DeleteIcon}
                            onPress={handleClearCache}
                            showChevron={!isClearingCache}
                            rightElement={isClearingCache ? <TIWILoader size={30} /> : undefined}
                        />
                    </View>

                    <View style={styles.itemWrapper}>
                        <SettingsItem
                            label="Reset Temporary Files"
                            icon={RestoreBinIcon}
                            onPress={handleResetTemporaryFiles}
                            showChevron={!isResettingFiles}
                            rightElement={isResettingFiles ? <TIWILoader size={30} /> : undefined}
                        />
                    </View>
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
    versionCard: {
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        alignItems: 'center',
    },
    versionLabel: {
        fontSize: 13,
        color: colors.mutedText,
        marginBottom: 4,
    },
    versionNumber: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.titleText,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    toggleTextContainer: {
        flex: 1,
        marginRight: 12,
    },
    toggleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.titleText,
    },
    toggleSubtitle: {
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    statusCard: {
        backgroundColor: colors.bgCards,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    statusText: {
        fontSize: 14,
        color: colors.bodyText,
        textAlign: 'center',
    },
    releaseNotes: {
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 8,
        textAlign: 'center',
    },
    progressBarContainer: {
        height: 4,
        backgroundColor: colors.bgStroke,
        borderRadius: 2,
        marginBottom: 12,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primaryCTA,
        borderRadius: 2,
    },
    listWrapper: {
        gap: 16,
    },
    itemWrapper: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
    },
});
