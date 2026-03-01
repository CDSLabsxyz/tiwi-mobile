/**
 * Mobile Session Manager
 * 
 * Orchestrates the cloud session logic with React Native specific hardware data.
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useDeviceStore } from '../store/deviceStore';
import { SessionMetadata } from '../types/session';
import { cloudSessionService } from './cloudSessionService';
import { deviceService } from './deviceService';

class MobileSessionManager {
    /**
     * Initializes the cloud session for the current mobile device.
     * Maps hardware fingerprints to the cloud registry.
     */
    async syncCurrentSession(walletAddress: string) {
        try {
            const deviceId = await deviceService.getOrCreateDeviceId();
            const locationInfo = await deviceService.fetchLocationInfo();

            const deviceName = Device.deviceName ||
                (Platform.OS === 'ios' ? 'iPhone' : Device.modelName || 'Android Device');

            const metadata: SessionMetadata = {
                device_id: deviceId,
                device_name: `${deviceName} (${Device.osName})`,
                platform: Platform.OS as 'ios' | 'android' | 'web',
                ip_address: locationInfo.ip,
                location: locationInfo.locationStr
            };

            const session = await cloudSessionService.registerSession(supabase, walletAddress, metadata);

            if (session) {
                // Also update local store for UI responsiveness
                useDeviceStore.getState().addOrUpdateSession({
                    id: session.id,
                    deviceName: session.device_name,
                    ipAddress: session.ip_address,
                    location: session.location,
                    lastActive: new Date(session.last_active_at).getTime(),
                    isActive: session.is_active,
                    platform: session.platform
                });
            }

            return session;
        } catch (error: any) {
            if (error?.message?.includes('Network request failed')) {
                console.warn('[MobileSessionManager] Sync failed due to network unreachable. Skipping cloud sync.');
            } else {
                console.error('[MobileSessionManager] Sync Error:', error);
            }
            return null;
        }
    }

    /**
     * Subscribes to the "Kill Switch" for this device.
     * Triggers a callback (logout) if the session is revoked remotely.
     */
    subscribeToKillSwitch(walletAddress: string, deviceId: string, onRevoked: () => void) {
        const address = walletAddress.toLowerCase();

        return supabase
            .channel(`session-${deviceId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `wallet_address=eq.${address}` // Simplified filter for broader check or specific if possible
                },
                (payload) => {
                    const { device_id, is_active } = payload.new;
                    // Check if the change is for THIS device
                    if (device_id === deviceId && is_active === false) {
                        console.warn('[Kill-Switch] Session revoked remotely. Initializing logout.');
                        onRevoked();
                    }
                }
            )
            .subscribe();
    }
}

export const mobileSessionManager = new MobileSessionManager();
