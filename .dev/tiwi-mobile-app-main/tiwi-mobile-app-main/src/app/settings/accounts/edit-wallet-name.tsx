/**
 * Edit Wallet Name Screen
 * Edit wallet name page matching Figma design exactly (node-id: 3279-121862)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, BackHandler, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

export default function EditWalletNameScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [walletName, setWalletName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    if (!walletName.trim()) {
      // TODO: Show error message
      return;
    }

    setIsSaving(true);
    try {
      // TODO: Save wallet name to storage/backend
      // await saveWalletName(walletName.trim());
      
      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate back to Account Details
      router.back();
    } catch (error) {
      console.error('Failed to save wallet name:', error);
      // TODO: Show error message
    } finally {
      setIsSaving(false);
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
          paddingHorizontal: 20,
        }}
      >
        {/* Header with Back Button and Title - Matching Figma: 73px gap */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 73,
            paddingVertical: 10,
          }}
        >
          {/* Back Button */}
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

          {/* Title */}
          <Text
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
            }}
          >
            Edit Wallet Name
          </Text>
        </View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 20,
            paddingTop: 24,
            alignItems: 'center',
          }}
        >
          {/* Input Section - Matching Figma: 358px width, 8px gap */}
          <View
            style={{
              width: 358,
              maxWidth: '100%',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Label */}
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Enter New Wallet Name
            </Text>

            {/* Input Field - Matching Figma: 64px height, 16px border radius, bgSemi background */}
            <View
              style={{
                height: 64,
                backgroundColor: colors.bgSemi,
                borderRadius: 16,
                paddingHorizontal: 17,
                paddingVertical: 10,
                justifyContent: 'center',
              }}
            >
              <TextInput
                value={walletName}
                onChangeText={setWalletName}
                placeholder="New Wallet Name"
                placeholderTextColor={colors.mutedText}
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 14,
                  color: colors.titleText,
                  width: '100%',
                  paddingVertical: 10,
                }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>

          {/* Save Button - Matching Figma: Fixed at bottom, 358px width, 54px height, primaryCTA color */}
          <View
            style={{
              position: 'absolute',
              bottom: (bottom || 16) + 32,
              left: 20,
              right: 20,
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={!walletName.trim() || isSaving}
              style={{
                width: 358,
                maxWidth: '100%',
                height: 54,
                backgroundColor: walletName.trim() && !isSaving ? colors.primaryCTA : colors.bgCards,
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
                  color: walletName.trim() && !isSaving ? colors.bg : colors.bodyText,
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

