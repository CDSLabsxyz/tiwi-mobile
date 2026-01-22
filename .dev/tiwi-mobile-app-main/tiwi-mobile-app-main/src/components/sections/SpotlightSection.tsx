import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { SpotlightToken } from '@/types';
import { Skeleton } from '../ui/Skeleton';

interface SpotlightSectionProps {
  tokens: SpotlightToken[];
  isLoading?: boolean;
}

/**
 * Spotlight Section
 * Horizontal scrollable crypto cards
 * Matches Figma design exactly
 */
export const SpotlightSection: React.FC<SpotlightSectionProps> = ({
  tokens,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <View className="flex-col gap-2 w-[353px]">
        <View className="flex-row items-center justify-between">
          <Skeleton width={72} height={22} borderRadius={4} />
          <Skeleton width={16} height={16} borderRadius={4} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row gap-1.5"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} width={100} height={51} borderRadius={100} />
          ))}
        </ScrollView>
      </View>
    );
  }

  const getChangeColor = (change: number) => {
    return change >= 0 ? colors.success : colors.error;
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <View className="flex-col gap-2 w-[353px]">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Text
          className="text-base"
          style={{
            fontFamily: 'Manrope-SemiBold',
            fontSize: 16,
            color: colors.titleText,
          }}
        >
          Spotlight
        </Text>
        <TouchableOpacity>
          <Image
            source={require('../../assets/home/arrow-right-01.svg')}
            className="w-4 h-4"
            contentFit="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Scrollable Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row"
        contentContainerStyle={{ gap: 6 }}
      >
        {tokens.map((token) => (
          <View
            key={token.id}
            className="flex-row items-center gap-2 pl-2 pr-4 py-2 rounded-full"
            style={{
              borderWidth: 1,
              borderColor: colors.bgStroke,
            }}
          >
            <Image
              source={token.logo}
              className="w-8 h-8 rounded-full"
              contentFit="cover"
            />
            <View className="flex-col items-start justify-center">
              <Text
                className="text-sm"
                style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 14,
                  color: colors.titleText,
                }}
              >
                {token.symbol}
              </Text>
              <Text
                className="text-xs"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 12,
                  color: getChangeColor(token.change24h),
                }}
              >
                {formatChange(token.change24h)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};


