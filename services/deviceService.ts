/**
 * Device Service
 * 
 * Handles device identification and geolocation for the Tiwi Protocol.
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { DeviceSession, useDeviceStore } from '../store/deviceStore';

export interface LocationInfo {
    ip: string;
    city: string;
    country: string;
    locationStr: string;
}

class DeviceService {
    /**
     * Gets or creates a unique ID for this device
     */
    async getOrCreateDeviceId(): Promise<string> {
        const state = useDeviceStore.getState();
        if (state.currentDeviceId) return state.currentDeviceId;

        const newId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        state.setCurrentDeviceId(newId);
        return newId;
    }

    /**
     * Fetches the current device's public IP and location details
     */
    async fetchLocationInfo(): Promise<LocationInfo> {
        try {
            // Using ipapi.co as seen in the Tiwi Web App
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();

            return {
                ip: data.ip || 'Unknown',
                city: data.city || 'Unknown',
                country: data.country_name || 'Unknown',
                locationStr: data.city && data.country_name
                    ? `${data.city}, ${data.country_name}`
                    : data.city || data.country_name || 'Unknown'
            };
        } catch (error) {
            console.warn('[DeviceService] Failed to fetch location info:', error);
            return {
                ip: '127.0.0.1',
                city: 'Unknown',
                country: 'Unknown',
                locationStr: 'Unknown'
            };
        }
    }

    /**
     * Registers or updates the current device session
     */
    async registerSession(): Promise<DeviceSession> {
        const deviceId = await this.getOrCreateDeviceId();
        const locationInfo = await this.fetchLocationInfo();

        const deviceName = Device.deviceName ||
            (Platform.OS === 'ios' ? 'iPhone' : Device.modelName || 'Android Device');

        const session: DeviceSession = {
            id: deviceId,
            deviceName: `${deviceName} (${Device.osName})`,
            ipAddress: locationInfo.ip,
            location: locationInfo.locationStr,
            lastActive: Date.now(),
            isActive: true,
            platform: Platform.OS as 'ios' | 'android' | 'web'
        };

        useDeviceStore.getState().addOrUpdateSession(session);
        return session;
    }

    /**
     * Formats registration of mock data for development visibility (demo purposes)
     */
    addMockSessions() {
        const store = useDeviceStore.getState();
        if (store.sessions.length > 1) return;

        const mocks: DeviceSession[] = [
            {
                id: 'mock_1',
                deviceName: 'iPhone 14 Pro (iOS)',
                ipAddress: '192.168.1.45',
                location: 'San Francisco, USA',
                lastActive: Date.now() - 3600000,
                isActive: false,
                platform: 'ios'
            },
            {
                id: 'mock_2',
                deviceName: 'Chrome on Windows',
                ipAddress: '82.161.12.44',
                location: 'London, UK',
                lastActive: Date.now() - 86400000,
                isActive: false,
                platform: 'web'
            }
        ];

        mocks.forEach(m => store.addOrUpdateSession(m));
    }
}

export const deviceService = new DeviceService();
