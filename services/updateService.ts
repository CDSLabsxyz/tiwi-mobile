/**
 * App Update Service
 *
 * Handles automatic APK updates for sideloaded Android builds.
 * - Checks a Supabase `app_versions` table for the latest version
 * - Downloads the APK in the background
 * - Triggers the Android system install prompt (1 tap from the user)
 *
 * Supabase table: `app_versions`
 * Columns: version (text), build_number (int), apk_url (text),
 *          release_notes (text), force_update (bool), created_at (timestamptz)
 */

import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface VersionInfo {
    version: string;
    buildNumber: number;
    apkUrl: string;
    releaseNotes: string;
    forceUpdate: boolean;
}

export type UpdateStatus =
    | 'idle'
    | 'checking'
    | 'no-update'
    | 'update-available'
    | 'downloading'
    | 'ready-to-install'
    | 'installing'
    | 'error';

type UpdateListener = (status: UpdateStatus, progress?: number, versionInfo?: VersionInfo | null, error?: string) => void;

class UpdateService {
    private listeners: Set<UpdateListener> = new Set();
    private status: UpdateStatus = 'idle';
    private progress: number = 0;
    private latestVersion: VersionInfo | null = null;
    private downloadedApkUri: string | null = null;
    private error: string | null = null;

    /** Subscribe to update status changes */
    subscribe(listener: UpdateListener) {
        this.listeners.add(listener);
        // Immediately fire current state
        listener(this.status, this.progress, this.latestVersion, this.error ?? undefined);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        for (const listener of this.listeners) {
            listener(this.status, this.progress, this.latestVersion, this.error ?? undefined);
        }
    }

    private setStatus(status: UpdateStatus, progress?: number) {
        this.status = status;
        if (progress !== undefined) this.progress = progress;
        this.notify();
    }

    /** Get the current installed app version */
    getCurrentVersion(): string {
        return Application.nativeApplicationVersion ?? '1.0.0';
    }

    /** Get the current build number */
    getCurrentBuildNumber(): number {
        const buildNum = Application.nativeBuildVersion;
        return buildNum ? parseInt(buildNum, 10) : 1;
    }

    /**
     * Compare two semver version strings.
     * Returns true if remote is newer than local.
     */
    private isNewerVersion(local: string, remote: string): boolean {
        const localParts = local.split('.').map(Number);
        const remoteParts = remote.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            const l = localParts[i] || 0;
            const r = remoteParts[i] || 0;
            if (r > l) return true;
            if (r < l) return false;
        }
        return false;
    }

    /**
     * Check Supabase `app_versions` table for the latest version.
     * Fetches the most recent row ordered by created_at desc.
     */
    async checkForUpdate(): Promise<VersionInfo | null> {
        if (Platform.OS !== 'android') {
            this.setStatus('no-update');
            return null;
        }

        this.setStatus('checking');
        this.error = null;

        try {
            const { data, error } = await supabase
                .from('app_versions')
                .select('version, build_number, apk_url, release_notes, force_update')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw new Error(error.message);
            if (!data) throw new Error('No version info found');

            const versionInfo: VersionInfo = {
                version: data.version,
                buildNumber: data.build_number,
                apkUrl: data.apk_url,
                releaseNotes: data.release_notes || '',
                forceUpdate: data.force_update || false,
            };

            this.latestVersion = versionInfo;

            const currentVersion = this.getCurrentVersion();
            const hasUpdate = this.isNewerVersion(currentVersion, versionInfo.version);

            if (hasUpdate) {
                this.setStatus('update-available');
                return versionInfo;
            } else {
                this.setStatus('no-update');
                return null;
            }
        } catch (err: any) {
            console.warn('[UpdateService] Check failed:', err.message);
            this.error = err.message || 'Failed to check for updates';
            this.setStatus('error');
            return null;
        }
    }

    /**
     * Download the APK to local storage.
     * Progress is reported via listeners.
     */
    async downloadUpdate(): Promise<string | null> {
        if (!this.latestVersion?.apkUrl) {
            this.error = 'No update URL available';
            this.setStatus('error');
            return null;
        }

        this.setStatus('downloading', 0);

        const apkFileName = `tiwi-${this.latestVersion.version}.apk`;
        const apkPath = `${FileSystem.cacheDirectory}${apkFileName}`;

        try {
            // Remove old APK if it exists
            const existing = await FileSystem.getInfoAsync(apkPath);
            if (existing.exists) {
                await FileSystem.deleteAsync(apkPath, { idempotent: true });
            }

            const downloadResumable = FileSystem.createDownloadResumable(
                this.latestVersion.apkUrl,
                apkPath,
                {},
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesExpectedToWrite > 0
                        ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
                        : 0;
                    this.setStatus('downloading', Math.round(progress * 100));
                }
            );

            const result = await downloadResumable.downloadAsync();
            if (!result?.uri) {
                throw new Error('Download completed but no file URI returned');
            }

            this.downloadedApkUri = result.uri;
            this.setStatus('ready-to-install', 100);
            return result.uri;
        } catch (err: any) {
            console.error('[UpdateService] Download failed:', err.message);
            this.error = err.message || 'Download failed';
            this.setStatus('error');
            return null;
        }
    }

    /**
     * Trigger the Android system install dialog for the downloaded APK.
     * This is the ONE tap the user needs — the OS install confirmation.
     */
    async installUpdate(): Promise<void> {
        if (!this.downloadedApkUri) {
            this.error = 'No downloaded APK found';
            this.setStatus('error');
            return;
        }

        this.setStatus('installing');

        try {
            // Get a content:// URI that Android can use
            const contentUri = await FileSystem.getContentUriAsync(this.downloadedApkUri);

            await IntentLauncher.startActivityAsync(
                'android.intent.action.INSTALL_PACKAGE',
                {
                    data: contentUri,
                    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                    type: 'application/vnd.android.package-archive',
                }
            );

            // After the install dialog, reset state
            this.setStatus('idle');
        } catch (err: any) {
            console.error('[UpdateService] Install trigger failed:', err.message);
            this.error = err.message || 'Failed to start installer';
            this.setStatus('error');
        }
    }

    /**
     * Full auto-update flow:
     * 1. Check for update
     * 2. Download if available
     * 3. Trigger install
     */
    async autoUpdate(): Promise<void> {
        const update = await this.checkForUpdate();
        if (!update) return;

        const uri = await this.downloadUpdate();
        if (!uri) return;

        await this.installUpdate();
    }

    /** Clean up any previously downloaded APKs */
    async cleanup(): Promise<void> {
        try {
            const cacheDir = FileSystem.cacheDirectory;
            if (!cacheDir) return;

            const contents = await FileSystem.readDirectoryAsync(cacheDir);
            for (const file of contents) {
                if (file.endsWith('.apk') && file.startsWith('tiwi-')) {
                    await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
                }
            }
        } catch (e) {
            console.warn('[UpdateService] Cleanup failed:', e);
        }
    }

    getStatus() {
        return { status: this.status, progress: this.progress, latestVersion: this.latestVersion, error: this.error };
    }
}

export const updateService = new UpdateService();
