/**
 * Tutorials Screen
 * Tutorials page with YouTube routing matching Figma design exactly (node-id: 3279-121361)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, BackHandler, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { StatusBar } from '@/components/ui/StatusBar';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ChevronLeftIcon = require('@/assets/swap/arrow-left-02.svg');
const SearchIcon = require('@/assets/swap/search-01.svg');

interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnail: string; // Placeholder for thumbnail image
}

const tutorials: Tutorial[] = [
  {
    id: '1',
    title: 'How to swap',
    description: 'Learn the basics of swapping tokens on TIWI Protocol',
    youtubeUrl: 'https://www.youtube.com/watch?v=example1', // TODO: Replace with actual YouTube URLs
    thumbnail: '',
  },
  {
    id: '2',
    title: 'Add liquidity',
    description: 'Learn how to add liquidity to pools',
    youtubeUrl: 'https://www.youtube.com/watch?v=example2',
    thumbnail: '',
  },
  {
    id: '3',
    title: 'Create a pool',
    description: 'Learn how to create your own liquidity pool',
    youtubeUrl: 'https://www.youtube.com/watch?v=example3',
    thumbnail: '',
  },
  {
    id: '4',
    title: 'Stake tokens',
    description: 'Learn how to stake tokens and earn rewards',
    youtubeUrl: 'https://www.youtube.com/watch?v=example4',
    thumbnail: '',
  },
  {
    id: '5',
    title: 'How to swap',
    description: 'Learn the basics of swapping tokens on TIWI Protocol',
    youtubeUrl: 'https://www.youtube.com/watch?v=example5',
    thumbnail: '',
  },
  {
    id: '6',
    title: 'Add liquidity',
    description: 'Learn how to add liquidity to pools',
    youtubeUrl: 'https://www.youtube.com/watch?v=example6',
    thumbnail: '',
  },
];

export default function TutorialsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleTutorialPress = async (tutorial: Tutorial) => {
    try {
      const canOpen = await Linking.canOpenURL(tutorial.youtubeUrl);
      if (canOpen) {
        await Linking.openURL(tutorial.youtubeUrl);
      } else {
        console.error('Cannot open YouTube URL');
      }
    } catch (error) {
      console.error('Error opening YouTube:', error);
    }
  };

  const filteredTutorials = tutorials.filter((tutorial) =>
    tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              fontSize: 18,
              lineHeight: 18,
              color: colors.titleText,
              flex: 1,
              textAlign: 'center',
            }}
          >
            Tutorials
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 40,
          paddingBottom: (bottom || 16) + 24,
          paddingHorizontal: 18,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 40,
          }}
        >
          {/* Search Bar */}
          <View
            style={{
              height: 48,
              backgroundColor: '#1b1b1b',
              borderRadius: 20,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
              }}
            >
              <Image
                source={SearchIcon}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
            <TextInput
              style={{
                flex: 1,
                fontFamily: 'Manrope-Regular',
                fontSize: 14,
                color: 'rgba(255,255,255,0.7)',
                padding: 0,
              }}
              placeholder="Search"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Tutorial Grid */}
          <View
            style={{
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {filteredTutorials.map((tutorial, index) => {
              // Create 2 columns layout
              if (index % 2 === 0) {
                const tutorial1 = filteredTutorials[index];
                const tutorial2 = filteredTutorials[index + 1];

                return (
                  <View
                    key={`row-${index}`}
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                    }}
                  >
                    {/* Tutorial Card 1 */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleTutorialPress(tutorial1)}
                      style={{
                        flex: 1,
                        backgroundColor: colors.bgSemi,
                        borderRadius: 16,
                        padding: 5,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: 125,
                          backgroundColor: colors.bg,
                          borderRadius: 16,
                          marginBottom: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'Manrope-Medium',
                            fontSize: 12,
                            color: colors.bodyText,
                            textAlign: 'center',
                          }}
                        >
                          Video Thumbnail
                        </Text>
                      </View>
                      <View style={{ padding: 10 }}>
                        <Text
                          style={{
                            fontFamily: 'Manrope-Medium',
                            fontSize: 16,
                            color: colors.bodyText,
                            marginBottom: 4,
                          }}
                        >
                          {tutorial1.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: 'Manrope-Medium',
                            fontSize: 12,
                            color: colors.bodyText,
                          }}
                        >
                          {tutorial1.description}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Tutorial Card 2 */}
                    {tutorial2 && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleTutorialPress(tutorial2)}
                        style={{
                          flex: 1,
                          backgroundColor: colors.bgSemi,
                          borderRadius: 16,
                          padding: 5,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            height: 125,
                            backgroundColor: colors.bg,
                            borderRadius: 16,
                            marginBottom: 2,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Manrope-Medium',
                              fontSize: 12,
                              color: colors.bodyText,
                              textAlign: 'center',
                            }}
                          >
                            Video Thumbnail
                          </Text>
                        </View>
                        <View style={{ padding: 10 }}>
                          <Text
                            style={{
                              fontFamily: 'Manrope-Medium',
                              fontSize: 16,
                              color: colors.bodyText,
                              marginBottom: 4,
                            }}
                          >
                            {tutorial2.title}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'Manrope-Medium',
                              fontSize: 12,
                              color: colors.bodyText,
                            }}
                          >
                            {tutorial2.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
              return null;
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}





