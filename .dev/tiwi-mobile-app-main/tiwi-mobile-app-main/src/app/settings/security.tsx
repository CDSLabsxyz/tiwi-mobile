/**
 * Security Settings Screen
 * Main security settings page matching Figma design exactly (node-id: 3279-120926)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ChevronRightIcon = require('@/assets/home/arrow-right-01.svg');

// Icons from Figma - will download these
const ResetPasswordIcon = require('@/assets/settings/reset-password.svg');
const BiometricAccessIcon = require('@/assets/settings/biometric-access.svg');
const Timer02Icon = require('@/assets/settings/timer-02.svg');
const AlertSquareIcon = require('@/assets/wallet/alert-square.svg');
const AddressBookIcon = require('@/assets/settings/address-book.svg');

// Toggle Switch Component
interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ value, onValueChange }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 40,
          height: 24,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: value ? colors.primaryCTA : '#4e634b',
          backgroundColor: colors.bg,
          padding: 2,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 10,
            backgroundColor: value ? colors.primaryCTA : '#4e634b',
            transform: [{ translateX: value ? 16 : 0 }],
          }}
        />
      </View>
    </TouchableOpacity>
  );
};

export default function SecuritySettingsScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, [params.returnTo]);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings' as any);
    }
  };

  const handleChangePin = () => {
    router.push('/settings/security/change-pin' as any);
  };

  const handleAutoLockTimer = () => {
    router.push('/settings/security/auto-lock-timer' as any);
  };

  const handleFraudAlerts = () => {
    router.push('/settings/security/fraud-alerts' as any);
  };

  const handleWhitelistAddresses = () => {
    router.push('/settings/security/whitelist-addresses' as any);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 42,
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
            }}
          >
            Security
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 24,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'column',
            gap: 36,
            width: '100%',
            maxWidth: 400,
          }}
        >
          {/* Change PIN */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleChangePin}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={ResetPasswordIcon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 18,
                  lineHeight: 18,
                  color: colors.titleText,
                }}
              >
                Change PIN
              </Text>
            </View>
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={ChevronRightIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          </TouchableOpacity>

          {/* Enable/Disable Biometrics */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={BiometricAccessIcon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 18,
                  lineHeight: 18,
                  color: colors.titleText,
                }}
              >
                Enable/Disable Biometrics
              </Text>
            </View>
            <ToggleSwitch
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
            />
          </View>

          {/* Auto-Lock Timer */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAutoLockTimer}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={Timer02Icon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 18,
                  lineHeight: 18,
                  color: colors.titleText,
                }}
              >
                Auto-Lock Timer
              </Text>
            </View>
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={ChevronRightIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          </TouchableOpacity>

          {/* Fraud Alerts & Suspicious Activity */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleFraudAlerts}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={AlertSquareIcon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 18,
                  lineHeight: 18,
                  color: colors.titleText,
                }}
              >
                Fraud Alerts & Suspicious Activity
              </Text>
            </View>
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={ChevronRightIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          </TouchableOpacity>

          {/* Whitelist Addresses */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleWhitelistAddresses}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={AddressBookIcon}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 18,
                  lineHeight: 18,
                  color: colors.titleText,
                }}
              >
                Whitelist Addresses
              </Text>
            </View>
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={ChevronRightIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
