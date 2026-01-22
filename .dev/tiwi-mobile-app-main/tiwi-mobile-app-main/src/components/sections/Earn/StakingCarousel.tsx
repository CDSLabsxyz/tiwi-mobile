/**
 * Staking Carousel Component
 * Banner carousel for staking promotions
 * Matches Figma design exactly
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';

const MegaphoneIcon = require('@/assets/earn/megaphone-02.svg');
const ArrowRightIcon = require('@/assets/earn/arrow-right-02.svg');

interface StakingCarouselProps {
  onPress?: () => void;
}

/**
 * Staking Carousel - Promotional banner with carousel indicators
 */
export const StakingCarousel: React.FC<StakingCarouselProps> = ({ onPress }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = ['Maximize Your Yields', 'Diverse', 'Simple'];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: colors.bgCards,
        height: 48,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 8,
      }}
    >
      {/* Megaphone Icon */}
      <View
        style={{
          width: 24,
          height: 24,
        }}
      >
        <Image
          source={MegaphoneIcon}
          className="w-full h-full"
          contentFit="contain"
        />
      </View>

      {/* Text Content */}
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope-Regular',
            fontSize: 10,
            color: colors.mutedText,
          }}
        >
          Stake
        </Text>
        <Text
          style={{
            fontFamily: 'Manrope-Medium',
            fontSize: 14,
            color: colors.titleText,
          }}
        >
          {slides[currentSlide]}
        </Text>
      </View>

      {/* Arrow Icon */}
      <View
        style={{
          width: 16,
          height: 16,
        }}
      >
        <Image
          source={ArrowRightIcon}
          className="w-full h-full"
          contentFit="contain"
        />
      </View>

      {/* Carousel Indicators - Positioned absolutely at bottom */}
      <View
        style={{
          position: 'absolute',
          bottom: 8,
          right: 16,
          flexDirection: 'row',
          gap: 2,
          alignItems: 'center',
        }}
      >
        {slides.map((_, index) => (
          <View
            key={index}
            style={{
              height: 1,
              width: index === currentSlide ? 16 : 8,
              borderRadius: 8,
              backgroundColor: index === currentSlide ? colors.primaryCTA : '#273024',
            }}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
};

