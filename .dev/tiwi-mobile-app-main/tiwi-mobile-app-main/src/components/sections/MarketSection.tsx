import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { TradingPair } from '@/types';
import { Skeleton } from '../ui/Skeleton';

interface MarketSectionProps {
  pairs: TradingPair[];
  isLoading?: boolean;
}

const tabs = [
  { id: 'favourite', label: 'Favourite' },
  { id: 'top', label: 'Top' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'new', label: 'New' },
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
];

/**
 * Market Section
 * Tabbed interface with trading pairs list
 * Matches Figma design exactly
 */
export const MarketSection: React.FC<MarketSectionProps> = ({
  pairs,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState('top');

  if (isLoading) {
    return (
      <View className="flex-col gap-2 w-full">
        <Skeleton width={54} height={22} borderRadius={4} />
        <View className="flex-row gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} width={50} height={16} borderRadius={4} />
          ))}
        </View>
        <View className="flex-col gap-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width="100%" height={55} borderRadius={0} />
          ))}
        </View>
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
    <View className="flex-col gap-2 items-center w-full" style={{ width: 393 }}>
      {/* Header */}
      <View className="flex-col gap-2 items-start w-full">
        <View className="px-5 w-full">
          <Text
            className="text-base"
            style={{
              fontFamily: 'Manrope-SemiBold',
              fontSize: 16,
              color: colors.titleText,
            }}
          >
            Market
          </Text>
        </View>

        {/* Tabs */}
        <View
          className="flex-row gap-4 px-5 border-b w-full"
          style={{
            borderBottomColor: colors.bgStroke,
            borderBottomWidth: 0.5,
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className="flex-col gap-2.5 h-[26px] items-center"
              >
                <Text
                  className="text-xs"
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 12,
                    color: isActive ? colors.primaryCTA : colors.bodyText,
                  }}
                >
                  {tab.label}
                </Text>
                {isActive && (
                  <View
                    className="h-0 w-full"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: colors.primaryCTA,
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Trading Pairs List */}
      <View className="flex-col items-start w-[353px]">
        {pairs.map((pair) => (
          <TouchableOpacity
            key={pair.id}
            className="flex-row items-center gap-2.5 py-2.5 w-full"
          >
            {/* Logo */}
            <Image
              source={pair.logo}
              className="w-8 h-8 rounded-full"
              contentFit="cover"
            />

            {/* Info */}
            <View className="flex-1 flex-col items-start justify-center">
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-sm"
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 14,
                    color: colors.titleText,
                  }}
                >
                  {pair.baseSymbol}
                </Text>
                <Text
                  className="text-sm"
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 14,
                    color: colors.bodyText,
                  }}
                >
                  /{pair.quoteSymbol}
                </Text>
                <View
                  className="px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: colors.bgStroke }}
                >
                  <Text
                    className="text-[10px]"
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 10,
                      color: colors.bodyText,
                    }}
                  >
                    {pair.leverage}
                  </Text>
                </View>
              </View>
              <Text
                className="text-xs"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 12,
                  color: colors.bodyText,
                }}
              >
                {pair.volume}
              </Text>
            </View>

            {/* Price and Change */}
            <View className="flex-col items-end justify-center">
              <Text
                className="text-sm"
                style={{
                  fontFamily: 'Manrope-SemiBold',
                  fontSize: 14,
                  color: colors.titleText,
                }}
              >
                {pair.price}
              </Text>
              <Text
                className="text-xs"
                style={{
                  fontFamily: 'Manrope-Medium',
                  fontSize: 12,
                  color: getChangeColor(pair.change24h),
                }}
              >
                {formatChange(pair.change24h)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* View All Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center gap-3 px-6 py-2.5 rounded-full w-full mt-2"
          style={{ backgroundColor: colors.bgShade20 }}
        >
          <Text
            className="text-sm"
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 14,
              color: colors.titleText,
              lineHeight: 14 * 1.6,
            }}
          >
            View all
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

