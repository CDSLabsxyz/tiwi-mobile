/**
 * Export Recovery Phrase Screen
 * Warning popup modal matching Figma design exactly (node-id: 3279-121912)
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const AlertIcon = require('@/assets/wallet/alert-square.svg');

export default function ExportRecoveryPhraseScreen() {
  const { top } = useSafeAreaInsets();
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
      router.replace('/settings/accounts' as any);
    }
  };

  const handleShowRecoveryPhrase = () => {
    // Navigate to passcode entry screen
    router.push('/settings/accounts/export-recovery-phrase/passcode' as any);
  };

  const handleCancel = () => {
    handleBackPress();
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
            Export Recovery Phrase
          </Text>
        </View>
      </View>

      {/* Background Overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(1, 5, 1, 0.7)',
        }}
      />

      {/* Modal Card - Centered vertically and horizontally */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            width: 353,
            maxWidth: '100%',
            backgroundColor: colors.bgCards,
            borderRadius: 32,
            padding: 40,
            alignItems: 'center',
          }}
        >
        <View
          style={{
            width: '100%',
            flexDirection: 'column',
            gap: 32,
            alignItems: 'center',
          }}
        >
          {/* Icon and Message Section */}
          <View
            style={{
              width: '100%',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {/* Alert Icon - 48px size */}
            <View
              style={{
                width: 48,
                height: 48,
              }}
            >
              <Image
                source={AlertIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>

            {/* Message */}
            <View
              style={{
                width: '100%',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 16,
                  color: colors.titleText,
                  textAlign: 'center',
                }}
              >
                Never Share Your Recovery Phrase
              </Text>
              <Text
                style={{
                  fontFamily: 'Manrope-Regular',
                  fontSize: 12,
                  color: colors.bodyText,
                  textAlign: 'center',
                }}
              >
                Your recovery phrase grants total access to your assets. Guard it carefully.
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View
            style={{
              width: '100%',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            {/* Show Recovery Phrase Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleShowRecoveryPhrase}
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
                Show Recovery Phrase
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
      </View>
    </View>
  );
}

