/**
 * Staking Token Card Component
 * Displays token with APY for staking
 * Matches Figma design exactly
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';

const ArrowDownIcon = require('@/assets/home/arrow-down-01.svg');

interface StakingTokenCardProps {
  tokenSymbol: string;
  tokenName: string;
  apy: string;
  tokenIcon?: any;
  onPress?: () => void;
}

/**
 * Staking Token Card - Token display with APY
 */
export const StakingTokenCard: React.FC<StakingTokenCardProps> = ({
  tokenSymbol,
  tokenName,
  apy,
  tokenIcon,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: colors.bgSemi,
        height: 72,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
      }}
    >
      {/* Token Icon */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          overflow: 'hidden',
          marginRight: 8,
        }}
      >
        {tokenIcon ? (
          <Image
            source={tokenIcon}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: colors.bgStroke,
            }}
          />
        )}
      </View>

      {/* Token Info */}
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope-SemiBold',
            fontSize: 14,
            color: colors.titleText,
          }}
        >
          {tokenSymbol}
        </Text>
      </View>

      {/* APY */}
      <Text
        style={{
          fontFamily: 'Manrope-Regular',
          fontSize: 14,
          color: colors.titleText,
          marginRight: 8,
        }}
      >
        {apy}
      </Text>

      {/* Dropdown Arrow */}
      <View
        style={{
          width: 24,
          height: 24,
        }}
      >
        <Image
          source={ArrowDownIcon}
          className="w-full h-full"
          contentFit="contain"
        />
      </View>
    </TouchableOpacity>
  );
};

