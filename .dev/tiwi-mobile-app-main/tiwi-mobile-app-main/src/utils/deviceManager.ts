/**
 * Device Management Utility
 * Handles device detection, session tracking, and device information
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface DeviceSession {
  id: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  lastActive: number; // timestamp
  isActive: boolean;
  platform: 'ios' | 'android' | 'web';
}

const DEVICE_SESSIONS_KEY = '@tiwi_device_sessions';
const CURRENT_DEVICE_ID_KEY = '@tiwi_current_device_id';

/**
 * Get current device information
 */
export const getCurrentDeviceInfo = async (): Promise<{
  id: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web';
  ipAddress: string;
  location: string;
}> => {
  // Generate or retrieve device ID
  let deviceId = await AsyncStorage.getItem(CURRENT_DEVICE_ID_KEY);
  if (!deviceId) {
    // Use installation ID from expo-constants, or generate a unique ID
    deviceId = Constants.installationId || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(CURRENT_DEVICE_ID_KEY, deviceId);
  }

  // Get device name
  const deviceName = getDeviceName();

  // Get platform
  const platform = Platform.OS as 'ios' | 'android' | 'web';

  // Get IP address (mock for now - in production, this would come from backend)
  const ipAddress = await getIPAddress();

  // Get location (mock for now - in production, use IP geolocation service)
  const location = await getLocation(ipAddress);

  return {
    id: deviceId,
    deviceName,
    platform,
    ipAddress,
    location,
  };
};

/**
 * Get device name based on platform
 */
const getDeviceName = (): string => {
  if (Platform.OS === 'ios') {
    // On iOS, we can use device model from Constants
    const modelName = Constants.deviceName || 'iPhone';
    return modelName;
  } else if (Platform.OS === 'android') {
    // On Android, use device model
    const modelName = Constants.deviceName || 'Android Device';
    return modelName;
  } else {
    return 'Web Browser';
  }
};

/**
 * Get IP address (mock implementation)
 * In production, this would be retrieved from backend when device connects
 */
const getIPAddress = async (): Promise<string> => {
  // Mock IP address - in production, this would come from backend
  // or use a service like https://api.ipify.org?format=json
  try {
    // Try to get from storage first (if previously stored)
    const storedIP = await AsyncStorage.getItem('@tiwi_device_ip');
    if (storedIP) {
      return storedIP;
    }

    // Generate a mock IP address
    const mockIP = `102.89.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    await AsyncStorage.setItem('@tiwi_device_ip', mockIP);
    return mockIP;
  } catch (error) {
    console.error('Failed to get IP address:', error);
    return '102.89.14.221'; // Default mock IP
  }
};

/**
 * Get location from IP address (mock implementation)
 * In production, use an IP geolocation service
 */
const getLocation = async (ipAddress: string): Promise<string> => {
  // Mock location - in production, use IP geolocation service
  // like https://ipapi.co/{ip}/json/ or similar
  try {
    const storedLocation = await AsyncStorage.getItem('@tiwi_device_location');
    if (storedLocation) {
      return storedLocation;
    }

    // Mock locations
    const mockLocations = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    const location = mockLocations[Math.floor(Math.random() * mockLocations.length)];
    await AsyncStorage.setItem('@tiwi_device_location', location);
    return location;
  } catch (error) {
    console.error('Failed to get location:', error);
    return 'New York'; // Default location
  }
};

/**
 * Get all device sessions
 */
export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(DEVICE_SESSIONS_KEY);
    if (sessionsJson) {
      return JSON.parse(sessionsJson);
    }
    return [];
  } catch (error) {
    console.error('Failed to get device sessions:', error);
    return [];
  }
};

/**
 * Save device sessions
 */
const saveDeviceSessions = async (sessions: DeviceSession[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(DEVICE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save device sessions:', error);
  }
};

/**
 * Register current device session
 */
export const registerCurrentDevice = async (): Promise<DeviceSession> => {
  const deviceInfo = await getCurrentDeviceInfo();
  const sessions = await getDeviceSessions();

  // Check if device already exists
  let existingSession = sessions.find((s) => s.id === deviceInfo.id);

  if (existingSession) {
    // Update last active time and mark as active
    existingSession.lastActive = Date.now();
    existingSession.isActive = true;
    existingSession.deviceName = deviceInfo.deviceName;
    existingSession.ipAddress = deviceInfo.ipAddress;
    existingSession.location = deviceInfo.location;
  } else {
    // Create new session
    existingSession = {
      id: deviceInfo.id,
      deviceName: deviceInfo.deviceName,
      ipAddress: deviceInfo.ipAddress,
      location: deviceInfo.location,
      lastActive: Date.now(),
      isActive: true,
      platform: deviceInfo.platform,
    };
    sessions.push(existingSession);

    // Add some mock devices for testing (only on first registration)
    if (sessions.length === 1) {
      const mockDevices: DeviceSession[] = [
        {
          id: 'mock_device_1',
          deviceName: 'iPhone 14 Pro',
          ipAddress: '102.89.14.221',
          location: 'New York',
          lastActive: Date.now() - 120000, // 2 minutes ago
          isActive: false,
          platform: 'ios',
        },
        {
          id: 'mock_device_2',
          deviceName: 'iPhone 14 Pro',
          ipAddress: '102.89.14.221',
          location: 'New York',
          lastActive: Date.now() - 120000, // 2 minutes ago
          isActive: false,
          platform: 'ios',
        },
        {
          id: 'mock_device_3',
          deviceName: 'iPhone 14 Pro',
          ipAddress: '102.89.14.221',
          location: 'New York',
          lastActive: Date.now() - 120000, // 2 minutes ago
          isActive: false,
          platform: 'ios',
        },
        {
          id: 'mock_device_4',
          deviceName: 'iPhone 14 Pro',
          ipAddress: '102.89.14.221',
          location: 'New York',
          lastActive: Date.now() - 120000, // 2 minutes ago
          isActive: false,
          platform: 'ios',
        },
      ];
      sessions.push(...mockDevices);
    }
  }

  // Mark all other devices as inactive
  sessions.forEach((session) => {
    if (session.id !== deviceInfo.id) {
      session.isActive = false;
    }
  });

  await saveDeviceSessions(sessions);
  return existingSession;
};

/**
 * Terminate a device session
 */
export const terminateDeviceSession = async (deviceId: string): Promise<void> => {
  const sessions = await getDeviceSessions();
  const filtered = sessions.filter((s) => s.id !== deviceId);
  await saveDeviceSessions(filtered);
};

/**
 * Terminate all sessions except current device
 */
export const terminateAllOtherSessions = async (): Promise<void> => {
  const deviceInfo = await getCurrentDeviceInfo();
  const sessions = await getDeviceSessions();
  const filtered = sessions.filter((s) => s.id === deviceInfo.id);
  await saveDeviceSessions(filtered);
};

/**
 * Format time ago string
 */
export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return 'Active';
  } else if (minutes < 60) {
    return `${minutes} Min Ago`;
  } else if (hours < 24) {
    return `${hours} Hour${hours > 1 ? 's' : ''} Ago`;
  } else {
    return `${days} Day${days > 1 ? 's' : ''} Ago`;
  }
};

