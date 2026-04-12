/**
 * App Update Service
 *
 * Handles automatic APK updates for sideloaded Android builds.
 * - Checks Supabase `app_versions` table for the latest version
 * - Downloads the APK in the background
 * - Triggers the Android system install prompt (1 tap from the user)
 */

import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface VersionInfo {
    version: string;
    apkUrl: string;
    releaseNotes: string;
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

    subscribe(listener: UpdateListener) {
        this.listeners.add(listener);
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

    getCurrentVersion(): string {
        return Application.nativeApplicationVersion ?? '1.0.0';
    }

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
                .select('version, apk_url, release_notes')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw new Error(error.message);
            if (!data) throw new Error('No version info found');

            const versionInfo: VersionInfo = {
                version: data.version,
                apkUrl: data.apk_url,
                releaseNotes: data.release_notes || '',
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
            this.error = 'Unable to check for updates. Please try again later.';
            this.setStatus('error');
            return null;
        }
    }

    /**
     * Resolve redirects to get the final direct download URL.
     * GitHub releases use 302 redirects to a signed CDN URL.
     */
    private async resolveRedirectUrl(url: string): Promise<string> {
        try {
            const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
            return response.url || url;
        } catch {
            return url;
        }
    }

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
            const existing = await FileSystem.getInfoAsync(apkPath);
            if (existing.exists) {
                await FileSystem.deleteAsync(apkPath, { idempotent: true });
            }

            // Resolve GitHub redirect to get direct CDN URL
            const directUrl = await this.resolveRedirectUrl(this.latestVersion.apkUrl);

            const downloadResumable = FileSystem.createDownloadResumable(
                directUrl,
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
            this.error = 'Download failed. Please check your connection and try again.';
            this.setStatus('error');
            return null;
        }
    }

    async installUpdate(): Promise<void> {
        if (!this.downloadedApkUri) {
            this.error = 'No downloaded update found';
            this.setStatus('error');
            return;
        }

        this.setStatus('installing');

        try {
            const contentUri = await FileSystem.getContentUriAsync(this.downloadedApkUri);

            await IntentLauncher.startActivityAsync(
                'android.intent.action.INSTALL_PACKAGE',
                {
                    data: contentUri,
                    flags: 1,
                    type: 'application/vnd.android.package-archive',
                }
            );

            this.setStatus('idle');
        } catch (err: any) {
            console.error('[UpdateService] Install trigger failed:', err.message);
            this.error = 'Failed to open installer. Please try again.';
            this.setStatus('error');
        }
    }

    async autoUpdate(): Promise<void> {
        const update = await this.checkForUpdate();
        if (!update) return;

        const uri = await this.downloadUpdate();
        if (!uri) return;

        await this.installUpdate();
    }

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
