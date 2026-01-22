/**
 * Export Recovery Phrase - Reveal Screen
 * Tap to reveal recovery phrase matching Figma design exactly (node-id: 3279-122049)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { BlurView } from 'expo-blur';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');

// Mock recovery phrase - in production, retrieve securely after passcode validation
const MOCK_RECOVERY_PHRASE = [
  'seed', 'seed', 'seed', 'seed', 'seed', 'seed',
  'seed', 'seed', 'seed', 'seed', 'seed', 'seed',
];

export default function ExportRecoveryPhraseRevealScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [isRevealed, setIsRevealed] = useState(false);

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

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleContinue = () => {
    // Navigate to confirmation screen
    router.push('/settings/accounts/export-recovery-phrase/confirm' as any);
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
          <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 20, lineHeight: 20, color: colors.titleText }}>
            Export Recovery Phrase
          </Text>
        </View>
      </View>

      {/* Content - Centered */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        {/* Recovery Phrase Grid - Matching Figma: 342px width, exact positioning */}
        <View
          style={{
            width: 350,
            maxWidth: '100%',
            height: 253, // Height for 4 rows
            position: 'relative',
          }}
        >
          {/* Generate all 12 boxes with exact positioning from Figma */}
          {MOCK_RECOVERY_PHRASE.map((word, index) => {
            // Exact positions from Figma metadata (same as confirm screen)
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
                  {isRevealed ? word : 'seed'}
                </Text>
              </View>
            );
          })}

          {/* Tap to Reveal Overlay - Matching Figma exactly: backdrop-blur 7.5px, bg rgba(101,144,7,0.2), rounded 36px, full coverage */}
          {!isRevealed && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleReveal}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 36,
                overflow: 'hidden',
              }}
            >
              <BlurView
                intensity={20}
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(101, 144, 7, 0.2)', // Exact Figma color rgba(101,144,7,0.2)
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                }}
              >
                <View
                  style={{
                    width: 295,
                    flexDirection: 'column',
                    gap: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-SemiBold',
                      fontSize: 20,
                      lineHeight: 24,
                      color: '#e6e3f7', // Exact Figma color
                      textAlign: 'center',
                    }}
                  >
                    Tap to reveal your Secret Recovery Phrase
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          )}
        </View>

        {/* Continue Button - Show after reveal */}
        {isRevealed && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleContinue}
            style={{
              marginTop: 36,
              width: 358,
              maxWidth: '100%',
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
              Continue
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

