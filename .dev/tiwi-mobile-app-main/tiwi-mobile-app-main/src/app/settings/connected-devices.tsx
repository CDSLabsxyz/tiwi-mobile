/**
 * Connected Devices Screen
 * Connected devices list page matching Figma design exactly (node-id: 3279-120983)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';
import {
  getDeviceSessions,
  registerCurrentDevice,
  terminateDeviceSession,
  terminateAllOtherSessions,
  formatTimeAgo,
  type DeviceSession,
} from '@/utils/deviceManager';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

export default function ConnectedDevicesScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, [params.returnTo]);

  // Load devices on mount and register current device
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      // Register current device first
      await registerCurrentDevice();
      // Then get all sessions
      const sessions = await getDeviceSessions();
      // Sort: active device first, then by last active time
      const sorted = sessions.sort((a, b) => {
        if (a.isActive) return -1;
        if (b.isActive) return 1;
        return b.lastActive - a.lastActive;
      });
      setDevices(sorted);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings' as any);
    }
  };

  const handleTerminateDevice = async (deviceId: string) => {
    try {
      await terminateDeviceSession(deviceId);
      await loadDevices(); // Reload devices
    } catch (error) {
      console.error('Failed to terminate device:', error);
    }
  };

  const handleTerminateAll = async () => {
    try {
      await terminateAllOtherSessions();
      await loadDevices(); // Reload devices
    } catch (error) {
      console.error('Failed to terminate all sessions:', error);
    }
  };

  const handleEndThisSession = (device: DeviceSession) => {
    router.push({
      pathname: '/settings/connected-devices/end-session',
      params: {
        deviceId: device.id,
        deviceName: device.deviceName,
        ipAddress: device.ipAddress,
        location: device.location,
        lastActive: device.lastActive.toString(),
      },
    } as any);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 21,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 15,
            paddingVertical: 10,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBackPress}
            style={{
              width: 24,
              height: 24,
            }}
          >
            <Image
              source={ChevronLeftIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            Connected Devices
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
        }}
      >
        {/* Scrollable Content */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: 8,
            paddingHorizontal: 20,
            alignItems: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Text */}
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              marginBottom: 13,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 12,
                lineHeight: 18,
                color: colors.titleText,
              }}
            >
              These are the devices currently logged into your TIWI Protocol Wallet.{' '}
              If you notice any unfamiliar activity, terminate the session immediately.
            </Text>
          </View>

          {/* Devices List */}
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              flexDirection: 'column',
              gap: 30,
            }}
          >
            {devices.map((device) => (
              <View
                key={device.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 15,
                  width: '100%',
                }}
              >
                {/* Device Info */}
                <View
                  style={{
                    flexDirection: 'column',
                    gap: 4,
                    width: 101,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      lineHeight: 21,
                      color: colors.titleText,
                    }}
                  >
                    {device.deviceName}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 12,
                      lineHeight: 18,
                      color: colors.titleText,
                    }}
                  >
                    {device.ipAddress}
                  </Text>
                </View>

                {/* Location */}
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    lineHeight: 18,
                    color: colors.titleText,
                    width: 62,
                  }}
                >
                  {device.location}
                </Text>

                {/* Status/Time */}
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    lineHeight: 18,
                    color: device.isActive ? colors.primaryCTA : colors.titleText,
                    width: 55,
                  }}
                >
                  {device.isActive ? 'Active' : formatTimeAgo(device.lastActive)}
                </Text>

                {/* Terminate Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if (device.isActive) {
                      handleEndThisSession(device);
                    } else {
                      handleTerminateDevice(device.id);
                    }
                  }}
                  style={{
                    backgroundColor: colors.bgCards,
                    borderRadius: 100,
                    padding: 10,
                    width: 90,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      lineHeight: 21,
                      color: colors.titleText,
                    }}
                  >
                    Terminate
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Fixed Bottom Section - Terminate All Sessions Button */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: (bottom || 16) + 24,
            alignItems: 'center',
            backgroundColor: colors.bg,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleTerminateAll}
              style={{
                width: '100%',
                height: 54,
                backgroundColor: colors.primaryCTA,
                borderRadius: 100,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 24,
                paddingVertical: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 16,
                  color: colors.bg,
                }}
              >
                Terminate All Sessions
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 12,
                lineHeight: 18,
                color: colors.titleText,
                textAlign: 'center',
              }}
            >
              Signs out every device except the one you're using now.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
