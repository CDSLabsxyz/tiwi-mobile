import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { StatCard } from '@/types';
import { Skeleton } from '../ui/Skeleton';

interface TradeStatsSectionProps {
  stats: StatCard[];
  isLoading?: boolean;
}

// Icon mappings for stat cards
const iconMap: Record<string, string> = {
  'trade-up': 'https://www.figma.com/api/mcp/asset/0bc17d57-56b3-422e-be30-2b341008ace9',
  'coins': 'https://www.figma.com/api/mcp/asset/2939c294-93b8-4927-a6b7-eb9cf6e8dbef',
  'locked': 'https://www.figma.com/api/mcp/asset/89c81eec-6bd9-4b9a-883d-9696a6d68dee',
};

// Chain logos for Active Chains card
const chainLogos = [
  require('../../assets/home/chains/ethereum.svg'),
  require('../../assets/home/chains/solana.svg'),
  require('../../assets/home/chains/polygon.svg'),
  require('../../assets/home/chains/avalanche.svg'),
  require('../../assets/home/chains/bsc.svg'),
  require('../../assets/home/chains/sui.svg'),
  require('../../assets/home/chains/near.svg'),
  require('../../assets/home/chains/bitcoin.svg'),
];

/**
 * Trade Stats Section
 * Shows statistics cards in a grid layout
 * Matches Figma design exactly
 */
export const TradeStatsSection: React.FC<TradeStatsSectionProps> = ({
  stats,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <View className="flex-col gap-2 w-[353px]">
        <Skeleton width={159} height={22} borderRadius={4} />
        <View className="flex-row gap-2">
          <Skeleton width={172.5} height={101} borderRadius={16} />
          <Skeleton width={172.5} height={101} borderRadius={16} />
        </View>
        <View className="flex-row gap-2">
          <Skeleton width={112.33} height={94} borderRadius={16} />
          <Skeleton width={112.33} height={94} borderRadius={16} />
          <Skeleton width={112.33} height={94} borderRadius={16} />
        </View>
      </View>
    );
  }

  const firstRow = stats.slice(0, 2);
  const secondRow = stats.slice(2);

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
          Trade Without Limits
        </Text>
      </View>

      {/* First Row */}
      <View className="flex-row gap-2">
        {firstRow.map((stat) => (
          <View
            key={stat.id}
            className="flex-1 p-3 rounded-2xl"
            style={{ backgroundColor: colors.bgCards }}
          >
            {stat.id === '2' ? (
              // Active Chains Card
              <View className="flex-col gap-2.5">
                <View className="h-6 relative">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {chainLogos.map((logo, index) => (
                      <Image
                        key={index}
                        source={logo}
                        className="w-6 h-6 rounded-full"
                        contentFit="cover"
                        style={{
                          marginLeft: index === 0 ? 0 : 10,
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
                <View className="flex-col gap-0.5 px-3">
                  <Text
                    className="text-base"
                    style={{
                      fontFamily: 'Manrope-SemiBold',
                      fontSize: 16,
                      color: colors.titleText,
                    }}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 12,
                      color: colors.bodyText,
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              </View>
            ) : (
              // Regular Stat Card
              <View className="flex-col gap-2.5">
                {stat.iconType === 'image' && stat.icon && (
                  <Image
                    source={stat.icon}
                    className="w-6 h-6 rounded-full"
                    contentFit="cover"
                  />
                )}
                {stat.iconType === 'icon' && stat.icon && iconMap[stat.icon] && (
                  <Image
                    source={iconMap[stat.icon]}
                    className="w-5 h-5"
                    contentFit="contain"
                  />
                )}
                <View className="flex-col gap-0.5">
                  <Text
                    className="text-lg"
                    style={{
                      fontFamily: 'Manrope-SemiBold',
                      fontSize: stat.id === '1' ? 18 : 16,
                      color: colors.titleText,
                    }}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 12,
                      color: colors.bodyText,
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Second Row */}
      <View className="flex-row gap-2">
        {secondRow.map((stat) => (
          <View
            key={stat.id}
            className="flex-1 p-3 rounded-2xl"
            style={{ backgroundColor: colors.bgCards }}
          >
            <View className="flex-col gap-2.5">
              {stat.icon && iconMap[stat.icon] && (
                <Image
                  source={iconMap[stat.icon]}
                  className="w-5 h-5"
                  contentFit="contain"
                />
              )}
              <View className="flex-col gap-0.5">
                <Text
                  className="text-base"
                  style={{
                    fontFamily: 'Manrope-SemiBold',
                    fontSize: 16,
                    color: colors.titleText,
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  className="text-xs"
                  style={{
                    fontFamily: 'Manrope-Medium',
                    fontSize: 12,
                    color: colors.bodyText,
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};


