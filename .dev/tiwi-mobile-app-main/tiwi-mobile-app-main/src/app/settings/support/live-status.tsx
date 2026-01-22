/**
 * Live Status Screen
 * Live status page matching Figma design exactly (node-id: 3279-121284)
 */

import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'down';
}

const serviceStatuses: ServiceStatus[] = [
  {
    id: 'swap',
    name: 'Swap',
    description: 'Swaps executing normally',
    status: 'operational',
  },
  {
    id: 'liquidity',
    name: 'Liquidity',
    description: 'Reward distribution delays detected',
    status: 'degraded',
  },
  {
    id: 'bridge',
    name: 'Bridge',
    description: 'Bridging offline due to maintenance',
    status: 'operational',
  },
  {
    id: 'governance',
    name: 'Governance',
    description: 'Voting and proposals active',
    status: 'operational',
  },
  {
    id: 'nodes',
    name: 'Nodes',
    description: 'Some node connections unstable',
    status: 'down',
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'operational':
      return '#00822b';
    case 'degraded':
      return '#ce9a2d';
    case 'down':
      return '#d21010';
    default:
      return '#00822b';
  }
};

const getStatusTextColor = (status: string) => {
  switch (status) {
    case 'operational':
      return '#bdf4cf';
    case 'degraded':
      return '#bdf4cf';
    case 'down':
      return '#ffc5c5';
    default:
      return '#bdf4cf';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'operational':
      return 'Operational';
    case 'degraded':
      return 'Degraded';
    case 'down':
      return 'Down';
    default:
      return 'Operational';
  }
};

export default function LiveStatusScreen() {
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
            Live Status
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 40,
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
            gap: 8,
          }}
        >
          {serviceStatuses.map((service) => (
            <View
              key={service.id}
              style={{
                height: 80,
                backgroundColor: colors.bgSemi,
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Left: Service Info */}
              <View
                style={{
                  flexDirection: 'column',
                  gap: 4,
                  flex: 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 18,
                    color: colors.titleText,
                  }}
                >
                  {service.name}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: colors.titleText,
                  }}
                >
                  {service.description}
                </Text>
              </View>

              {/* Right: Status Badge */}
              <View
                style={{
                  backgroundColor: getStatusColor(service.status),
                  borderRadius: 100,
                  paddingHorizontal: 10,
                  paddingVertical: 10,
                  minWidth: 87,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: getStatusTextColor(service.status),
                  }}
                >
                  {getStatusLabel(service.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}





