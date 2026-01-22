/**
 * Notifications Settings Screen
 * Main notifications page matching Figma design exactly (node-id: 3279-121080)
 */

import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const ChevronRightIcon = require('@/assets/home/arrow-right-01.svg');
const TransactionHistoryIcon = require('@/assets/home/transaction-history.svg');
const CrownIcon = require('@/assets/settings/crown.svg');
const UserGroupIcon = require('@/assets/settings/user-group-02.svg');
const NewsIcon = require('@/assets/settings/news-01.svg');
const AlertCircleIcon = require('@/assets/settings/alert-circle.svg');

interface NotificationCategory {
  id: string;
  title: string;
  icon: string;
  route: string;
}

const notificationCategories: NotificationCategory[] = [
  {
    id: 'transactions',
    title: 'Transactions',
    icon: TransactionHistoryIcon,
    route: '/settings/notifications/transactions',
  },
  {
    id: 'rewards-earnings',
    title: 'Rewards & Earnings',
    icon: CrownIcon,
    route: '/settings/notifications/rewards-earnings',
  },
  {
    id: 'governance',
    title: 'Governance',
    icon: UserGroupIcon,
    route: '/settings/notifications/governance',
  },
  {
    id: 'news',
    title: 'News & Announcements',
    icon: NewsIcon,
    route: '/settings/notifications/news',
  },
  {
    id: 'system-alerts',
    title: 'System Alerts',
    icon: AlertCircleIcon,
    route: '/settings/notifications/system-alerts',
  },
];

export default function NotificationsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();

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

  const handleCategoryPress = (category: NotificationCategory) => {
    router.push(category.route as any);
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
            Notifications
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
          {notificationCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              activeOpacity={0.8}
              onPress={() => handleCategoryPress(category)}
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
                    source={category.icon}
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
                  {category.title}
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





