import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { DexMarket } from '@/types';
import { Skeleton } from '../ui/Skeleton';

interface SmartMarketsSectionProps {
  markets: DexMarket[];
  isLoading?: boolean;
}

/**
 * Smart Markets Section
 * Horizontal scrollable DEX logo buttons
 * Matches Figma design exactly
 */
export const SmartMarketsSection: React.FC<SmartMarketsSectionProps> = ({
  markets,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <View className="flex-col gap-2 w-[353px]">
        <Skeleton width={112} height={22} borderRadius={4} />
        <View className="flex-row gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} width={116} height={38} borderRadius={100} />
          ))}
        </View>
      </View>
    );
  }

  // Split into two rows (5 items first row, rest in second)
  const firstRow = markets.slice(0, 5);
  const secondRow = markets.slice(5);

  return (
    <View className="flex-col gap-2 w-[353px]">
      {/* Header */}
      <View className="flex-col items-start">
        <Text
          className="text-base"
          style={{
            fontFamily: 'Manrope-SemiBold',
            fontSize: 16,
            color: colors.titleText,
          }}
        >
          Smart Markets
        </Text>
      </View>

      {/* Markets Grid */}
      <View className="flex-col gap-2">
        {/* First Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {firstRow.map((market) => (
            <TouchableOpacity
              key={market.id}
              className="flex-row items-center gap-2 px-4 py-2.5 rounded-full"
              style={{
                borderWidth: 1,
                borderColor: colors.bgStroke,
              }}
            >
              <Image
                source={market.logo}
                className="w-5 h-5 rounded-full"
                contentFit="cover"
              />
              <Text
                className="text-sm"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 14,
                  color: colors.titleText,
                }}
              >
                {market.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Second Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {secondRow.map((market) => (
            <TouchableOpacity
              key={market.id}
              className="flex-row items-center gap-2 px-4 py-2.5 rounded-full"
              style={{
                borderWidth: 1,
                borderColor: colors.bgStroke,
              }}
            >
              <Image
                source={market.logo}
                className="w-5 h-5 rounded-full"
                contentFit="cover"
              />
              <Text
                className="text-sm"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 14,
                  color: colors.titleText,
                }}
              >
                {market.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};


