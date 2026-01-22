/**
 * Disconnect Wallet - Passcode Entry Screen
 * 6-digit PIN entry with biometric option matching Figma design exactly (node-id: 3279-122005)
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, BackHandler, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const DeleteIcon = 'https://www.figma.com/api/mcp/asset/f4a911be-fdf3-4cde-931b-8b6f16b7ca40';

export default function DisconnectWalletPasscodeScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [passcode, setPasscode] = useState<string[]>(Array(6).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => backHandler.remove();
  }, [params.returnTo]);

  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    const isComplete = passcode.every((digit) => digit !== '') && passcode.length === 6;
    if (isComplete) {
      Keyboard.dismiss();
      // TODO: Validate passcode and disconnect wallet
      // For now, navigate back to account settings
      router.back();
    }
  }, [passcode, router]);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings/accounts/disconnect-wallet' as any);
    }
  };

  const handleTextChange = (text: string, index: number) => {
    if (text.length > 1) text = text.slice(-1);
    if (text && !/^[0-9]$/.test(text)) return;

    const newPasscode = [...passcode];
    newPasscode[index] = text;
    setPasscode(newPasscode);

    if (text && index < 5) {
      setFocusedIndex(index + 1);
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 50);
    } else if (text && index === 5) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!passcode[index] && index > 0) {
        const newPasscode = [...passcode];
        newPasscode[index - 1] = '';
        setPasscode(newPasscode);
        setFocusedIndex(index - 1);
        setTimeout(() => inputRefs.current[index - 1]?.focus(), 50);
      } else if (passcode[index]) {
        const newPasscode = [...passcode];
        newPasscode[index] = '';
        setPasscode(newPasscode);
      }
    }
  };

  const handleNumericKeyPress = (digit: string) => {
    if (focusedIndex < 6) handleTextChange(digit, focusedIndex);
  };

  const handleDelete = () => {
    if (focusedIndex > 0 && !passcode[focusedIndex]) {
      const newPasscode = [...passcode];
      newPasscode[focusedIndex - 1] = '';
      setPasscode(newPasscode);
      setFocusedIndex(focusedIndex - 1);
      setTimeout(() => inputRefs.current[focusedIndex - 1]?.focus(), 50);
    } else if (passcode[focusedIndex]) {
      const newPasscode = [...passcode];
      newPasscode[focusedIndex] = '';
      setPasscode(newPasscode);
    }
  };

  const handleBiometricAuth = async () => {
    // TODO: Implement biometric authentication using expo-local-authentication
    // For now, this is a placeholder
    console.log('Biometric authentication pressed');
    // Example implementation:
    // try {
    //   const result = await LocalAuthentication.authenticateAsync({
    //     promptMessage: 'Authenticate to disconnect wallet',
    //     fallbackLabel: 'Use passcode',
    //   });
    //   if (result.success) {
    //     // Disconnect wallet and navigate back
    //     // await disconnectWallet();
    //     if (params.returnTo) {
    //       router.push(params.returnTo as any);
    //     } else {
    //       router.replace('/settings/accounts' as any);
    //     }
    //   }
    // } catch (error) {
    //   console.error('Biometric authentication error:', error);
    // }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header - Matching Figma: Back button with gradient background */}
      <View style={{ paddingTop: top || 0, backgroundColor: colors.bg, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBackPress}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={['rgba(27, 27, 27, 0.3)', 'rgba(129, 129, 129, 0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 24, height: 24 }}>
                <Image source={ChevronLeftIcon} className="w-full h-full" contentFit="contain" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* PIN Entry Boxes */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14.5, marginBottom: 24 }}>
          {Array.from({ length: 6 }).map((_, index) => {
            const hasValue = passcode[index] !== '';
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => {
                  setFocusedIndex(index);
                  inputRefs.current[index]?.focus();
                }}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 8,
                  borderWidth: 0.2,
                  borderColor: colors.titleText,
                  backgroundColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TextInput
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  value={passcode[index]}
                  onChangeText={(text) => handleTextChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  onFocus={() => setFocusedIndex(index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                  autoFocus={index === 0}
                />
                {hasValue && (
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.titleText }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Biometric Button - Show if available */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleBiometricAuth}
          style={{
            marginTop: 24,
            paddingVertical: 12,
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope-Regular',
              fontSize: 14,
              color: colors.primaryCTA,
            }}
          >
            Use Biometric Authentication
          </Text>
        </TouchableOpacity>
      </View>

      {/* Numeric Keyboard */}
      <BlurView
        intensity={54.366}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 290,
          backgroundColor: 'rgba(21, 21, 21, 0.85)',
        }}
      >
        <View style={{ flex: 1, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 34 }}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: 5, marginBottom: 5 }}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  activeOpacity={0.8}
                  onPress={() => handleNumericKeyPress(digit)}
                  style={{
                    flex: 1,
                    height: 46,
                    backgroundColor: '#6f6f70',
                    borderRadius: 4.6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 0,
                  }}
                >
                  <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 25, color: colors.titleText }}>
                    {digit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 5 }}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleNumericKeyPress('0')}
              style={{
                flex: 1,
                height: 46,
                backgroundColor: '#6f6f70',
                borderRadius: 4.6,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 0,
              }}
            >
              <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 25, color: colors.titleText }}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={handleDelete} style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 23, height: 17 }}>
                <Image source={{ uri: DeleteIcon }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 34, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <View style={{ width: 134, height: 5, borderRadius: 100, backgroundColor: colors.titleText }} />
        </View>
      </BlurView>
    </View>
  );
}

