/**
 * Export Recovery Phrase - Verification Screen
 * Word selection verification matching Figma design exactly (node-id: 3279-122169)
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
  'seed', 'fire', 'kill', 'dash', 'nope', 'tore',
  'word', 'seed', 'kill', 'seed', 'word', 'seed',
];

// Mock word options for selection
const WORD_OPTIONS = [
  'seed', 'fire', 'kill', 'dash', 'nope', 'tore',
  'word', 'seed', 'kill', 'seed', 'word', 'seed',
];

// Correct order for verification (positions 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
const CORRECT_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function ExportRecoveryPhraseVerifyScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [selectedWords, setSelectedWords] = useState<(string | null)[]>(Array(12).fill(null));
  const [availableWords, setAvailableWords] = useState<string[]>([...WORD_OPTIONS]);
  const [error, setError] = useState<string | null>(null);

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

  const handleWordSelect = (word: string) => {
    // Clear error when user selects a word
    if (error) setError(null);
    
    // Find first empty slot
    const emptyIndex = selectedWords.findIndex((w) => w === null);
    if (emptyIndex !== -1) {
      const newSelected = [...selectedWords];
      newSelected[emptyIndex] = word;
      setSelectedWords(newSelected);
      
      // Remove word from available options
      const wordIndex = availableWords.indexOf(word);
      if (wordIndex !== -1) {
        const newAvailable = [...availableWords];
        newAvailable.splice(wordIndex, 1);
        setAvailableWords(newAvailable);
      }
    }
  };

  const handleRemoveWord = (index: number) => {
    if (selectedWords[index]) {
      // Clear error when user removes a word
      if (error) setError(null);
      
      const word = selectedWords[index];
      const newSelected = [...selectedWords];
      newSelected[index] = null;
      setSelectedWords(newSelected);
      
      // Add word back to available options
      setAvailableWords([...availableWords, word!]);
    }
  };

  const handleConfirm = () => {
    // Verify all words are selected
    if (!isComplete) {
      setError('Please select all 12 words');
      return;
    }

    // Verify the order matches
    const isCorrect = selectedWords.every((word, index) => {
      return word === MOCK_RECOVERY_PHRASE[index];
    });

    if (isCorrect) {
      // Clear any previous errors
      setError(null);
      // Navigate back to account settings
      router.replace('/settings/accounts' as any);
    } else {
      // Show error message
      setError('The recovery phrase order is incorrect. Please try again.');
      // Clear selected words to allow retry
      setSelectedWords(Array(12).fill(null));
      setAvailableWords([...WORD_OPTIONS]);
    }
  };

  const isComplete = selectedWords.every((w) => w !== null);

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

      {/* Content */}
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
        {/* Header Text */}
        <View style={{ width: 354, maxWidth: '100%', marginBottom: 19, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'Manrope-Bold',
              fontSize: 24,
              color: colors.titleText,
              textAlign: 'center',
              marginBottom: 54,
            }}
          >
            Seed Phrase
          </Text>
          <Text
            style={{
              fontFamily: 'Manrope-Regular',
              fontSize: 14,
              color: 'rgba(230, 227, 247, 0.75)',
              textAlign: 'center',
            }}
          >
            Select each word in the order it was presented to you.
          </Text>
        </View>

        {/* Selected Words Grid - Matching Figma: 3 columns, some empty */}
        <View
          style={{
            width: 354,
            maxWidth: '100%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 30,
          }}
        >
          {selectedWords.map((word, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              onPress={() => handleRemoveWord(index)}
              style={{
                width: 106,
                height: 45,
                borderWidth: 1,
                borderColor: '#4e634b',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 27,
                paddingVertical: 29,
                backgroundColor: word ? colors.bg : 'transparent',
              }}
            >
              {word ? (
                <Text
                  style={{
                    fontFamily: 'Manrope-Regular',
                    fontSize: 16,
                    color: 'rgba(230, 227, 247, 0.75)',
                  }}
                >
                  {word}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Available Words Grid - Matching Figma: Selected words highlighted in primaryCTA */}
        <View
          style={{
            width: 354,
            maxWidth: '100%',
            minHeight: 202,
            backgroundColor: colors.bgCards,
            borderRadius: 12,
            padding: 8,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'flex-start',
            justifyContent: 'center',
            marginBottom: 30,
          }}
        >
          {availableWords.map((word, index) => {
            const isSelected = selectedWords.includes(word);
            return (
              <TouchableOpacity
                key={`${word}-${index}`}
                activeOpacity={0.8}
                onPress={() => handleWordSelect(word)}
                disabled={isSelected}
                style={{
                  height: 45,
                  minWidth: 79,
                  backgroundColor: isSelected ? colors.primaryCTA : 'transparent',
                  borderWidth: 1,
                  borderColor: '#498f00',
                  borderRadius: isSelected ? 12 : 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 27,
                  paddingVertical: 15,
                  opacity: isSelected ? 1 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope-Regular',
                    fontSize: 16,
                    color: isSelected ? '#050201' : colors.titleText,
                  }}
                >
                  {word}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Error Message */}
        {error && (
          <Text
            style={{
              fontFamily: 'Manrope-Regular',
              fontSize: 14,
              color: colors.error,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            {error}
          </Text>
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleConfirm}
          disabled={!isComplete}
          style={{
            width: 354,
            maxWidth: '100%',
            height: 54,
            backgroundColor: isComplete ? colors.primaryCTA : colors.bgCards,
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
              lineHeight: 25.6,
              color: isComplete ? '#050201' : colors.bodyText,
            }}
          >
            Confirm
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

