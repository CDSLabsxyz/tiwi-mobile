/**
 * Settings Screen
 * Main settings page matching Figma design exactly (node-id: 3279-120767)
 */

import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ChevronRightIcon = require('@/assets/home/arrow-right-01.svg');

// Icons from Figma MCP server
const imgUserCircle = require('@/assets/settings/user-circle.svg');
const imgSecurityLock = require('@/assets/settings/security-lock.svg');
const imgPhoneDeveloperMode = require('@/assets/settings/phone-developer-mode.svg');
const imgLanguageSkill = require('@/assets/settings/language-skill.svg');
const imgNotification02 = require('@/assets/settings/notification-02.svg');
const imgDownload03 = require('@/assets/settings/download-03.svg');
const imgCustomerSupport = require('@/assets/settings/customer-support.svg');
const imgAddSquare = require('@/assets/settings/add-square.svg');
const imgCloudDownload = require('@/assets/settings/cloud-download.svg');

interface SettingsSection {
  id: string;
  title: string;
  icon: string;
  route?: string;
  onPress?: () => void;
}

const settingsSections: SettingsSection[] = [
  {
    id: 'account-details',
    title: 'Account Details',
    icon: imgUserCircle,
    route: '/settings/accounts',
  },
  {
    id: 'security',
    title: 'Security',
    icon: imgSecurityLock,
    route: '/settings/security',
  },
  {
    id: 'connected-devices',
    title: 'Connected Devices',
    icon: imgPhoneDeveloperMode,
    route: '/settings/connected-devices',
  },
  {
    id: 'language-region',
    title: 'Language & Region',
    icon: imgLanguageSkill,
    route: '/settings/language-region',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: imgNotification02,
    route: '/settings/notifications',
  },
  {
    id: 'app-updates-cache',
    title: 'App Updates & Cache',
    icon: imgDownload03,
    route: '/settings/app-updates-cache',
  },
  {
    id: 'support',
    title: 'Support',
    icon: imgCustomerSupport,
    route: '/settings/support',
  },
  {
    id: 'add-new-wallet',
    title: 'Add New Wallet',
    icon: imgAddSquare,
    route: '/settings/add-new-wallet',
  },
  {
    id: 'import-wallet',
    title: 'Import Wallet',
    icon: imgCloudDownload,
    onPress: () => {
      // TODO: Implement import wallet
      console.log('Import Wallet pressed');
    },
  },
];

export default function SettingsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ returnTo?: string }>();

  // Handle phone back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [params.returnTo]);

  const handleBackPress = () => {
    if (params.returnTo) {
      router.push(params.returnTo as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Default to home if no back history
      router.replace('/' as any);
    }
  };


  const handleSectionPress = (section: SettingsSection) => {
    if (section.onPress) {
      section.onPress();
    } else if (section.route) {
      // Pass the return route so we can navigate back
      const returnRoute = params.returnTo || '/settings';
      router.push(`${section.route}?returnTo=${encodeURIComponent(returnRoute)}` as any);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Sticky Header - Matching Figma design exactly */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 18,
        }}
      >
        {/* Header with Back Button and Title - Matching Figma: 24px gap, 10px vertical padding */}
        <View
          style={{
            width: 347,
            maxWidth: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            alignSelf: 'center',
          }}
        >
          {/* Back Button - Matching Figma: 24px size */}
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

          {/* Title - Matching Figma: 20px font, Manrope Medium, white, centered */}
          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
            }}
          >
            Settings
          </Text>

          {/* Spacer to center the title */}
          <View style={{ width: 24 }} />
        </View>
      </View>

      {/* Content - Matching Figma layout exactly */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 18,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >

        {/* Settings Sections - Matching Figma: 30px gap between items */}
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 30,
          }}
        >
          {settingsSections.map((section) => (
            <TouchableOpacity
              key={section.id}
              activeOpacity={0.8}
              onPress={() => handleSectionPress(section)}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Left: Icon + Title - Matching Figma: 8px gap between icon and text */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Icon - Matching Figma: 24px size */}
                <View
                  style={{
                    width: 24,
                    height: 24,
                  }}
                >
                  <Image
                    source={section.icon}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                  />
                </View>

                {/* Title - Matching Figma: 18px font, Manrope Medium, white */}
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 18,
                    lineHeight: 18,
                    color: colors.titleText,
                  }}
                >
                  {section.title}
                </Text>
              </View>

              {/* Right: Chevron - Matching Figma: 24px size */}
              <View
                style={{
                  width: 24,
                  height: 24,
                }}
              >
                <Image
                  source={ChevronRightIcon}
                  className="w-full h-full"
                  contentFit="contain"
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
