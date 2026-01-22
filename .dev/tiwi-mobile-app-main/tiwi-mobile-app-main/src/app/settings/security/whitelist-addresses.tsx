/**
 * Whitelist Addresses Screen
 * Whitelist addresses page matching Figma design exactly (node-id: 3279-121784)
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const Book02Icon = require('@/assets/settings/book-02.svg');

export default function WhitelistAddressesScreen() {
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
      router.replace('/settings/security' as any);
    }
  };

  const handleAddAddress = () => {
    // TODO: Implement add address functionality
    console.log('Add Address pressed');
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
            Whitelist Address
          </Text>
        </View>
      </View>

      {/* Content - Centered */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingBottom: (bottom || 16) + 24,
        }}
      >
        <View
          style={{
            alignItems: 'center',
            gap: 46,
            width: '100%',
            maxWidth: 400,
          }}
        >
          {/* Book Icon */}
          <View
            style={{
              width: 179,
              height: 179,
            }}
          >
            <Image
              source={Book02Icon}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>

          {/* Text and Button */}
          <View
            style={{
              alignItems: 'center',
              gap: 8,
              width: '100%',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 20,
                lineHeight: 30,
                color: colors.titleText,
                textAlign: 'center',
              }}
            >
              No Address Added Yet
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAddAddress}
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
                Add Address
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

