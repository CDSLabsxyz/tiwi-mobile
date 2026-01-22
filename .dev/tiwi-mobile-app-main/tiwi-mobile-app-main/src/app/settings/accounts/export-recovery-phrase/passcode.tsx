/**
 * Export Recovery Phrase - Passcode Entry Screen
 * 6-digit PIN entry matching Figma design exactly (node-id: 3279-121987)
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, BackHandler, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { BlurView } from 'expo-blur';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const DeleteIcon = require('@/assets/settings/Union.svg');

export default function ExportRecoveryPhrasePasscodeScreen() {
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
      // Navigate to reveal screen
      router.push('/settings/accounts/export-recovery-phrase/reveal' as any);
    }
  }, [passcode, router]);

  const handleBackPress = () => {
    router.replace('/settings/accounts' as any);
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

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header - Matching Figma: 42px gap, 20px horizontal padding, 10px vertical padding */}
      <View style={{ paddingTop: top || 0, backgroundColor: colors.bg, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 42, paddingVertical: 10 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleBackPress} style={{ width: 24, height: 24 }}>
            <Image source={ChevronLeftIcon} className="w-full h-full" contentFit="contain" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 20, lineHeight: 20, color: colors.titleText }}>
            Export Recovery Phrase
          </Text>
        </View>
      </View>

      {/* Passcode Input Boxes - Matching Figma: positioned at top: 331px from screen top, 54px size, 0.2px border, 8px radius */}
      <View style={{ flex: 1, position: 'relative' }}>
        <View 
          style={{ 
            position: 'absolute',
            top: 200 - (top || 0) - 59, // 331px from screen top, minus safe area and status bar (~59px)
            left: 0,
            right: 0,
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 14.5
          }}
        >
          {Array.from({ length: 6 }).map((_, index) => {
            const hasValue = passcode[index] !== '';
            return (
              <View
                key={index}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 8,
                  borderWidth: 0.2,
                  borderColor: colors.titleText,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setFocusedIndex(index);
                    inputRefs.current[index]?.focus();
                  }}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
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
              </View>
            );
          })}
        </View>
      </View>

      <BlurView
        intensity={54.366}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          // height: 290,
          backgroundColor: 'rgba(21, 21, 21, 0.85)',
        }}
      >
        <View style={{ flex: 1, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 0 }}>
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
                <Image source={DeleteIcon} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        {/* Home Indicator - Matching Figma: 34px height container, 134px width, 5px height, 8px from bottom */}
        <View style={{ height: 34, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <View style={{ width: 134, height: 5, borderRadius: 100, backgroundColor: '#FFFFFF' }} />
        </View>
      </BlurView>
    </View>
  );
}

