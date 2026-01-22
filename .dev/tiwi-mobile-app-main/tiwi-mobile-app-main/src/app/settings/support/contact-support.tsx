/**
 * Contact Support Screen
 * Contact support page with email, Telegram, and X links matching Figma design exactly (node-id: 3279-121496)
 */

import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ChevronRightIcon = require('@/assets/home/arrow-right-01.svg');
const MailIcon = require('@/assets/settings/mail-01.svg');
const TelegramIcon = require('@/assets/settings/telegram.svg');
const TwitterIcon = require('@/assets/settings/new-twitter-rectangle.svg');

interface ContactOption {
  id: string;
  title: string;
  icon: string;
  action: () => void;
}

export default function ContactSupportScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();

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
      router.replace('/settings/support' as any);
    }
  };

  const handleEmailPress = async () => {
    try {
      const email = 'support@tiwiprotocol.com'; // TODO: Replace with actual support email
      const mailtoLink = `mailto:${email}`;
      const canOpen = await Linking.canOpenURL(mailtoLink);
      if (canOpen) {
        await Linking.openURL(mailtoLink);
      } else {
        Alert.alert('Error', 'Unable to open email client');
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'Failed to open email client');
    }
  };

  const handleTelegramPress = async () => {
    try {
      // Telegram link - replace with actual Telegram channel/group
      const telegramUrl = 'https://t.me/tiwiprotocol'; // TODO: Replace with actual Telegram link
      const canOpen = await Linking.canOpenURL(telegramUrl);
      if (canOpen) {
        await Linking.openURL(telegramUrl);
      } else {
        Alert.alert('Error', 'Unable to open Telegram');
      }
    } catch (error) {
      console.error('Error opening Telegram:', error);
      Alert.alert('Error', 'Failed to open Telegram');
    }
  };

  const handleXPress = async () => {
    try {
      // X (Twitter) link - replace with actual X profile
      const xUrl = 'https://x.com/tiwiprotocol'; // TODO: Replace with actual X/Twitter link
      const canOpen = await Linking.canOpenURL(xUrl);
      if (canOpen) {
        await Linking.openURL(xUrl);
      } else {
        Alert.alert('Error', 'Unable to open X');
      }
    } catch (error) {
      console.error('Error opening X:', error);
      Alert.alert('Error', 'Failed to open X');
    }
  };

  const contactOptions: ContactOption[] = [
    {
      id: 'email',
      title: 'Email',
      icon: MailIcon,
      action: handleEmailPress,
    },
    {
      id: 'telegram',
      title: 'Telegram',
      icon: TelegramIcon,
      action: handleTelegramPress,
    },
    {
      id: 'x',
      title: 'X (formerly Twitter)',
      icon: TwitterIcon,
      action: handleXPress,
    },
  ];

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
            Contact Support
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {contactOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.8}
              onPress={option.action}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Left: Icon + Title */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 24,
                    height: 24,
                  }}
                >
                  <Image
                    source={option.icon}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                  />
                </View>

                {/* Title */}
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 18,
                    lineHeight: 18,
                    color: colors.bodyText,
                  }}
                >
                  {option.title}
                </Text>
              </View>

              {/* Right: Chevron */}
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





