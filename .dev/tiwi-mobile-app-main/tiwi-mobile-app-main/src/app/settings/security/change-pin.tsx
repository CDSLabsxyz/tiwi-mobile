/**
 * Change PIN Screen
 * Change PIN page matching Figma design exactly (node-id: 3279-121706)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, BackHandler, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

export default function ChangePinScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

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

  const handleConfirm = () => {
    // TODO: Validate and save PIN
    if (newPin === confirmPin && newPin.length >= 6) {
      // Save PIN logic here
      router.back();
    }
  };

  const isFormValid = currentPin.length >= 6 && newPin.length >= 6 && confirmPin.length >= 6 && newPin === confirmPin;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar />

      {/* Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
          paddingHorizontal: 18,
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
            Change Pin
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 18,
          paddingTop: 60,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'column',
            gap: 16,
            width: '100%',
            maxWidth: 400,
          }}
        >
          {/* Enter current PIN */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Enter current PIN
            </Text>
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
                value={currentPin}
                onChangeText={setCurrentPin}
                placeholder="******"
                placeholderTextColor={colors.mutedText}
                secureTextEntry
                maxLength={6}
                keyboardType="number-pad"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 20,
                  color: colors.mutedText,
                  width: '100%',
                }}
              />
            </View>
          </View>

          {/* Set new PIN */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              Set new PIN
            </Text>
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
                value={newPin}
                onChangeText={setNewPin}
                placeholder="******"
                placeholderTextColor={colors.mutedText}
                secureTextEntry
                maxLength={6}
                keyboardType="number-pad"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 20,
                  color: colors.mutedText,
                  width: '100%',
                }}
              />
            </View>
          </View>

          {/* Confirm new PIN */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 20,
                color: colors.bodyText,
              }}
            >
              Confirm new PIN
            </Text>
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
                value={confirmPin}
                onChangeText={setConfirmPin}
                placeholder="******"
                placeholderTextColor={colors.mutedText}
                secureTextEntry
                maxLength={6}
                keyboardType="number-pad"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 20,
                  color: colors.mutedText,
                  width: '100%',
                }}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Confirm Button */}
      <View
        style={{
          paddingHorizontal: 18,
          paddingBottom: (bottom || 16) + 24,
          alignItems: 'center',
          width: '100%',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleConfirm}
          disabled={!isFormValid}
          style={{
            width: '100%',
            maxWidth: 400,
            height: 54,
            backgroundColor: isFormValid ? colors.primaryCTA : colors.bgCards,
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
              color: isFormValid ? colors.bg : colors.bodyText,
            }}
          >
            Confirm
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

