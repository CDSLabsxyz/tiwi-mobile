/**
 * End This Session Screen
 * End session confirmation page matching Figma design exactly (node-id: 3279-121679)
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { terminateDeviceSession, formatTimeAgo } from '@/utils/deviceManager';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

export default function EndSessionScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    deviceId?: string;
    deviceName?: string;
    ipAddress?: string;
    location?: string;
    lastActive?: string;
  }>();

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings/connected-devices' as any);
    }
  };

  const handleYesTerminate = async () => {
    if (params.deviceId) {
      try {
        await terminateDeviceSession(params.deviceId);
        router.replace('/settings/connected-devices' as any);
      } catch (error) {
        console.error('Failed to terminate session:', error);
      }
    }
  };

  const handleCancel = () => {
    handleBackPress();
  };

  const deviceName = params.deviceName || 'This Device';
  const ipAddress = params.ipAddress || '102.89.14.221';
  const location = params.location || 'New York';
  const lastActive = params.lastActive ? parseInt(params.lastActive) : Date.now();
  const timeAgo = formatTimeAgo(lastActive);

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
            End This Session
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 21,
          alignItems: 'center',
        }}
      >
        {/* Info Text */}
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            marginTop: 8,
            marginBottom: 135,
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
            This device will be logged out immediately and will no longer have access to your wallet.
          </Text>
        </View>

        {/* Device Info */}
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 32,
            marginBottom: 135,
          }}
        >
          <View
            style={{
              flexDirection: 'column',
              gap: 0,
              width: 173,
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
              {deviceName}
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 12,
                lineHeight: 18,
                color: colors.titleText,
              }}
            >
              {ipAddress}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 12,
              lineHeight: 18,
              color: colors.titleText,
              width: 62,
            }}
          >
            {location}
          </Text>
          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 12,
              lineHeight: 18,
              color: colors.titleText,
              width: 55,
            }}
          >
            {timeAgo}
          </Text>
        </View>

        {/* Buttons */}
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 16,
            paddingBottom: (bottom || 16) + 24,
          }}
        >
          {/* Yes Terminate Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleYesTerminate}
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
              Yes Terminate
            </Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCancel}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: colors.bgCards,
              borderWidth: 1,
              borderColor: colors.primaryCTA,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 10,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 16,
                color: colors.primaryCTA,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

