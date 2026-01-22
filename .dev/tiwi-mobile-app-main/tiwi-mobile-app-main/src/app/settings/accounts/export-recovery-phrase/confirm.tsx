/**
 * Export Recovery Phrase - Confirmation Screen
 * 12-word grid with checkbox matching Figma design exactly (node-id: 3279-122101)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

// Mock recovery phrase - in production, retrieve securely
const MOCK_RECOVERY_PHRASE = [
  'seed', 'seed', 'seed', 'seed', 'seed', 'seed',
  'seed', 'seed', 'seed', 'seed', 'seed', 'seed',
];

export default function ExportRecoveryPhraseConfirmScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => backHandler.remove();
  }, [params.returnTo]);

  const handleBackPress = () => {
    router.replace('/settings/accounts' as any);
  };

  const handleConfirmBackup = () => {
    if (isConfirmed) {
      // Navigate to verification screen
      router.push('/settings/accounts/export-recovery-phrase/verify' as any);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
      <View style={{ paddingTop: top || 0, backgroundColor: colors.bg, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 42, paddingVertical: 10 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleBackPress} style={{ width: 24, height: 24 }}>
            <Image source={ChevronLeftIcon} className="w-full h-full" contentFit="contain" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 20, lineHeight: 20, color: colors.titleText, textAlign: 'center' }}>
            Export Recovery Phrase
          </Text>
        </View>
      </View>

      {/* Content - Scrollable for different device sizes */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: 354,
            maxWidth: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            minHeight: '100%',
            justifyContent: 'center',
          }}
        >
          {/* Header Section - Matching Figma: 44px gap */}
          <View style={{ width: 342, maxWidth: '100%', alignItems: 'center', marginBottom: 44 }}>
            <Text
              style={{
                fontFamily: 'Manrope-Bold',
                fontSize: 24,
                color: '#FFFFFF',
                textAlign: 'center',
                marginBottom: 54,
              }}
            >
              Backup Wallet
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                color: 'rgba(230, 227, 247, 0.75)', // Exact Figma color
                textAlign: 'center',
                width: 353,
                maxWidth: '100%',
              }}
            >
              This secret phrase unlocks your wallet. penxchain does not have access to this key. Ensure it is well protected.
            </Text>
          </View>

          {/* Recovery Phrase Grid with Numbers - Matching Figma exactly */}
          <View
            style={{
              width: '100%',
              flexDirection: 'column',
              gap: 34,
              alignItems: 'center',
              marginBottom: 34,
            }}
          >
            {/* Grid Container - Using absolute positioning to match Figma exactly: 342px width, 253px height */}
            <View style={{ width: 342, maxWidth: '100%', height: 253, position: 'relative' }}>
              {/* Generate all 12 boxes with exact positioning from Figma metadata */}
              {MOCK_RECOVERY_PHRASE.map((word, index) => {
                // Exact positions from Figma metadata
                const boxPositions = [
                  { x: 6, y: 0 },   // Box 1
                  { x: 124, y: 0 }, // Box 2
                  { x: 242, y: 0 }, // Box 3
                  { x: 6, y: 58 },  // Box 4
                  { x: 124, y: 58 }, // Box 5
                  { x: 242, y: 58 }, // Box 6
                  { x: 6, y: 116 },  // Box 7
                  { x: 124, y: 116 }, // Box 8
                  { x: 242, y: 116 }, // Box 9
                  { x: 6, y: 174 },  // Box 10
                  { x: 124, y: 174 }, // Box 11
                  { x: 242, y: 174 }, // Box 12
                ];
                
                const pos = boxPositions[index];
                
                return (
                  <View
                    key={index}
                    style={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y,
                      width: 106,
                      height: 45,
                      borderWidth: 1,
                      borderColor: '#4e634b', // Exact Figma color
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Manrope-Regular',
                        fontSize: 16,
                        lineHeight: 22,
                        color: 'rgba(230, 227, 247, 0.75)', // Exact Figma color
                      }}
                    >
                      {word}
                    </Text>
                  </View>
                );
              })}

              {/* Number Labels - Positioned exactly as in Figma metadata */}
              {[
                { num: 1, x: 23, y: 2 },
                { num: 2, x: 137, y: 2 },
                { num: 3, x: 255, y: 2 },
                { num: 4, x: 23, y: 58 },
                { num: 5, x: 137, y: 59 },
                { num: 6, x: 255, y: 64 },
                { num: 7, x: 23, y: 119 },
                { num: 8, x: 137, y: 119 },
                { num: 9, x: 255, y: 119 },
                { num: 10, x: 23, y: 176 },
                { num: 11, x: 137, y: 175 },
                { num: 12, x: 255, y: 180 },
              ].map(({ num, x, y }) => (
                <Text
                  key={num}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    fontFamily: 'Manrope-Regular',
                    fontSize: 14,
                    lineHeight: 22,
                    color: '#FFFFFF',
                  }}
                >
                  {num}
                </Text>
              ))}
            </View>

            {/* Checkbox - Matching Figma: 17px size, #b5b5b5 border, square */}
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                marginTop: 79,
                paddingLeft: 6,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsConfirmed(!isConfirmed)}
                style={{
                  width: 17,
                  height: 17,
                  borderWidth: 1,
                  borderColor: '#b5b5b5', // Exact Figma color
                  borderRadius: 0, // Square checkbox (no border radius)
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isConfirmed ? '#b1f128' : 'transparent',
                }}
              >
                {isConfirmed && (
                  <Text style={{ fontFamily: 'Manrope-Bold', color: '#050201', fontSize: 10 }}>✓</Text>
                )}
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: 'Manrope-Regular',
                  fontSize: 16,
                  lineHeight: 22,
                  color: '#b5b5b5', // Exact Figma color
                }}
              >
                I have saved the phrases
              </Text>
            </View>
          </View>

          {/* Confirm Backup Button - Matching Figma: #b1f128 background, #050201 text */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleConfirmBackup}
            disabled={!isConfirmed}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: isConfirmed ? '#b1f128' : colors.bgCards, // Exact Figma color
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 14,
              gap: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope-Medium',
                fontSize: 16,
                lineHeight: 25.6,
                color: isConfirmed ? '#050201' : colors.bodyText, // Exact Figma color
                textAlign: 'center',
              }}
            >
              Confirm Backup
            </Text>
          </TouchableOpacity>

          {/* Terms Text - Matching Figma: 14px, rgba(230,227,247,0.75), links in #b1f128 */}
          <View style={{ width: 342, padding: 10, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                color: 'rgba(230, 227, 247, 0.75)', // Exact Figma color
                textAlign: 'center',
              }}
            >
              By proceeding, you agree to our{' '}
              <Text style={{ fontFamily: 'Manrope-Regular', color: '#b1f128' }}>Terms & Conditions.</Text>
              {' '}Please read our{' '}
              <Text style={{ fontFamily: 'Manrope-Regular', color: '#b1f128' }}>Privacy Policy.</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

