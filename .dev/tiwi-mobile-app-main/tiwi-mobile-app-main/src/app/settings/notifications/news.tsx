/**
 * News & Announcements Notifications Screen
 * News notifications page matching Figma design exactly (node-id: 3279-121623)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

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

interface NotificationOption {
  id: string;
  label: string;
}

const notificationOptions: NotificationOption[] = [
  { id: 'protocol-updates', label: 'Protocol updates' },
  { id: 'new-feature-alerts', label: 'New feature alerts' },
  { id: 'security-updates', label: 'Security updates' },
];

export default function NewsNotificationsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    'protocol-updates': true,
    'new-feature-alerts': true,
    'security-updates': true,
  });

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
      router.replace('/settings/notifications' as any);
    }
  };

  const handleToggle = (id: string, value: boolean) => {
    setNotifications((prev) => ({
      ...prev,
      [id]: value,
    }));
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
              fontSize: 18,
              lineHeight: 18,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            News & Announcements
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 40,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 21,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {notificationOptions.map((option) => (
            <View
              key={option.id}
              style={{
                height: 40,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 16,
                  color: colors.bodyText,
                }}
              >
                {option.label}
              </Text>
              <ToggleSwitch
                value={notifications[option.id] || false}
                onValueChange={(value) => handleToggle(option.id, value)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}





