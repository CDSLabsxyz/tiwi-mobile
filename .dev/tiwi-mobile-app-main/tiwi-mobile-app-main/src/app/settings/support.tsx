/**
 * Support Settings Screen
 * Main support page matching Figma design exactly (node-id: 3279-121224)
 */

import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ChevronRightIcon = require('@/assets/home/arrow-right-01.svg');
const LiveStreamingIcon = require('@/assets/settings/live-streaming-01.svg');
const HelpSquareIcon = require('@/assets/settings/help-square.svg');
const ComputerVideoIcon = require('@/assets/settings/computer-video.svg');
const ComplaintIcon = require('@/assets/settings/complaint.svg');
const CustomerSupportIcon = require('@/assets/settings/customer-support.svg');

interface SupportOption {
  id: string;
  title: string;
  icon: string;
  route: string;
}

const supportOptions: SupportOption[] = [
  {
    id: 'live-status',
    title: 'Live Status',
    icon: LiveStreamingIcon,
    route: '/settings/support/live-status',
  },
  {
    id: 'faqs',
    title: 'FAQs',
    icon: HelpSquareIcon,
    route: '/settings/support/faqs',
  },
  {
    id: 'tutorials',
    title: 'Tutorials',
    icon: ComputerVideoIcon,
    route: '/settings/support/tutorials',
  },
  {
    id: 'report-bug',
    title: 'Report a Bug',
    icon: ComplaintIcon,
    route: '/settings/support/report-bug',
  },
  {
    id: 'contact-support',
    title: 'Contact Support',
    icon: CustomerSupportIcon,
    route: '/settings/support/contact-support',
  },
];

export default function SupportScreen() {
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
      router.replace('/settings' as any);
    }
  };

  const handleOptionPress = (option: SupportOption) => {
    router.push(option.route as any);
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
            Support
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
            gap: 30,
          }}
        >
          {supportOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.8}
              onPress={() => handleOptionPress(option)}
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
                    fontSize: 16,
                    lineHeight: 16,
                    color: colors.titleText,
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





