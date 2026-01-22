import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from '@/tw';
import { colors } from '@/theme';
import { WALLET_ADDRESS, truncateAddress } from '@/utils/wallet';
const TiwiCat = require('../../assets/home/tiwicat.svg');
const ArrowDown01 = require('../../assets/home/arrow-down-01.svg');
const Scan = require('../../assets/home/iris-scan.svg');
const Settings = require('../../assets/home/settings-03.svg');

interface HeaderProps {
  walletAddress?: string;
  onWalletPress?: () => void;
  onScanPress?: () => void;
  onSettingsPress?: () => void;
}

/**
 * Header Component
 * Shows logo, wallet address, scan and settings icons
 * Matches Figma design exactly
 */
export const Header: React.FC<HeaderProps> = ({
  walletAddress,
  onWalletPress,
  onScanPress,
  onSettingsPress,
}) => {
  // Use provided address or default to main wallet address
  const fullAddress = walletAddress || WALLET_ADDRESS;
  const displayAddress = truncateAddress(fullAddress);
  return (
    <View
      className="flex-row items-center justify-between px-5 py-[10px]"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Left Side - Logo and Wallet */}
      <View className="flex-row items-center gap-2">
        {/* Logo */}
        <View className="w-8 h-8">
          <Image
            source={TiwiCat}
            className="w-full h-full rounded-full"
            contentFit="cover"
          />
        </View>

        {/* Wallet Address Button */}
        <TouchableOpacity
          onPress={onWalletPress}
          className="flex-row items-center gap-[10px] px-4 py-[6.5px] rounded-full"
          style={{ backgroundColor: colors.bgSemi }}
        >
          <Text
            className="text-sm"
            style={{
              fontFamily: 'Manrope-Medium',
              fontSize: 14,
              color: colors.bodyText,
            }}
          >
            {displayAddress}
          </Text>
          <Image
            source={ArrowDown01}
            className="w-4 h-4"
            contentFit="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Right Side - Icons */}
      <View className="flex-row items-center gap-4">
        <TouchableOpacity onPress={onScanPress} className="w-6 h-6">
          <Image
            source={Scan}
            className="w-full h-full"
            contentFit="contain"
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSettingsPress} className="w-6 h-6">
          <Image
            source={Settings}
            className="w-full h-full"
            contentFit="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};


