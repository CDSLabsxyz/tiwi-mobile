import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export interface DeviceSession {
  id: string;
  deviceName: string;
  ipAddress: string;
  location: string;
  lastActive: number;
  isActive: boolean;
  platform: 'ios' | 'android' | 'web';
}

const DEVICE_SESSIONS_KEY = '@tiwi_device_sessions';
const CURRENT_DEVICE_ID_KEY = '@tiwi_current_device_id';

export const getCurrentDeviceInfo = async (): Promise<{
  id: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web';
  ipAddress: string;
  location: string;
}> => {
  let deviceId = await AsyncStorage.getItem(CURRENT_DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await AsyncStorage.setItem(CURRENT_DEVICE_ID_KEY, deviceId);
  }

  const deviceName = Device.deviceName || (Platform.OS === 'ios' ? 'iPhone' : 'Android Device');
  const platform = Platform.OS as 'ios' | 'android' | 'web';
  const ipAddress = await getIPAddress();
  const location = await getLocation(ipAddress);

  return {
    id: deviceId,
    deviceName,
    platform,
    ipAddress,
    location,
  };
};

const getIPAddress = async (): Promise<string> => {
  try {
    const storedIP = await AsyncStorage.getItem('@tiwi_device_ip');
    if (storedIP) return storedIP;

    const mockIP = `102.89.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    await AsyncStorage.setItem('@tiwi_device_ip', mockIP);
    return mockIP;
  } catch (error) {
    return '102.89.14.221';
  }
};

const getLocation = async (ipAddress: string): Promise<string> => {
  try {
    const storedLocation = await AsyncStorage.getItem('@tiwi_device_location');
    if (storedLocation) return storedLocation;

    const mockLocations = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Lagos', 'London'];
    const location = mockLocations[Math.floor(Math.random() * mockLocations.length)];
    await AsyncStorage.setItem('@tiwi_device_location', location);
    return location;
  } catch (error) {
    return 'New York';
  }
};

export const getDeviceSessions = async (): Promise<DeviceSession[]> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(DEVICE_SESSIONS_KEY);
    return sessionsJson ? JSON.parse(sessionsJson) : [];
  } catch (error) {
    return [];
  }
};

const saveDeviceSessions = async (sessions: DeviceSession[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(DEVICE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save device sessions:', error);
  }
};

export const registerCurrentDevice = async (): Promise<DeviceSession> => {
  const deviceInfo = await getCurrentDeviceInfo();
  const sessions = await getDeviceSessions();

  let existingSession = sessions.find((s) => s.id === deviceInfo.id);

  if (existingSession) {
    existingSession.lastActive = Date.now();
    existingSession.isActive = true;
    existingSession.deviceName = deviceInfo.deviceName;
    existingSession.ipAddress = deviceInfo.ipAddress;
    existingSession.location = deviceInfo.location;
  } else {
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

    if (sessions.length === 1) {
      sessions.push(
        {
          id: 'mock_device_1',
          deviceName: 'iPhone 14 Pro',
          ipAddress: '102.89.14.221',
          location: 'Lagos',
          lastActive: Date.now() - 120000,
          isActive: false,
          platform: 'ios',
        },
        {
          id: 'mock_device_2',
          deviceName: 'Pixel 7',
          ipAddress: '102.89.14.222',
          location: 'London',
          lastActive: Date.now() - 3600000,
          isActive: false,
          platform: 'android',
        }
      );
    }
  }

  sessions.forEach((session) => {
    if (session.id !== deviceInfo.id) {
      session.isActive = false;
    }
  });

  await saveDeviceSessions(sessions);
  return existingSession;
};

export const terminateDeviceSession = async (deviceId: string): Promise<void> => {
  const sessions = await getDeviceSessions();
  const filtered = sessions.filter((s) => s.id !== deviceId);
  await saveDeviceSessions(filtered);
};

export const terminateAllOtherSessions = async (): Promise<void> => {
  const deviceInfo = await getCurrentDeviceInfo();
  const sessions = await getDeviceSessions();
  const filtered = sessions.filter((s) => s.id === deviceInfo.id);
  await saveDeviceSessions(filtered);
};

export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Active';
  if (minutes < 60) return `${minutes} Min Ago`;
  if (hours < 24) return `${hours} Hour${hours > 1 ? 's' : ''} Ago`;
  return `${days} Day${days > 1 ? 's' : ''} Ago`;
};
