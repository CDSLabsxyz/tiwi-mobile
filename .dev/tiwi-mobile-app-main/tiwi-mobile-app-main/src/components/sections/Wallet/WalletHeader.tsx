/**
 * Wallet Header Component
 * Displays wallet logo, truncated address, and action icons
 * Matches Figma design exactly (node-id: 3279-118862)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";
import { truncateAddress } from "@/utils/wallet";

const TiwicatIcon = require("@/assets/home/tiwicat.svg");
const IrisScanIcon = require("@/assets/home/iris-scan.svg");
const SettingsIcon = require("@/assets/home/settings-03.svg");
const ChevronLeftIcon = require("@/assets/swap/arrow-left-02.svg");
const TransactionHistoryIcon = require("@/assets/home/transaction-history.svg");

interface WalletHeaderProps {
  walletAddress: string;
  onIrisScanPress?: () => void;
  onSettingsPress?: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
  showTransactionHistory?: boolean;
  onTransactionHistoryPress?: () => void;
}

/**
 * Wallet Header - Sticky header with logo, address, and action icons
 */
export const WalletHeader: React.FC<WalletHeaderProps> = ({
  walletAddress,
  onIrisScanPress,
  onSettingsPress,
  showBackButton = false,
  onBackPress,
  showTransactionHistory = false,
  onTransactionHistoryPress,
}) => {
  const displayAddress = truncateAddress(walletAddress);

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 10,
      }}
    >
      {/* Left: Back Button (if shown) + Logo + Address */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Back Button */}
        {showBackButton && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onBackPress}
            style={{
              width: 24,
              height: 24,
              marginRight: 0,
            }}
          >
            <Image
              source={ChevronLeftIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </TouchableOpacity>
        )}

        {/* Tiwicat Logo */}
        {!showBackButton && (
          <View
            style={{
              width: 32,
              height: 32,
            }}
          >
            <Image
              source={TiwicatIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </View>
        )}

        {/* Address Pill */}
        <View
          style={{
            backgroundColor: colors.bgSemi,
            paddingHorizontal: 16,
            paddingVertical: 6.5,
            borderRadius: 100,
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              color: colors.bodyText,
            }}
          >
            {displayAddress}
          </Text>
        </View>
      </View>

      {/* Right: Action Icons */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Transaction History Icon (if shown) */}
        {showTransactionHistory && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onTransactionHistoryPress}
            style={{
              width: 24,
              height: 24,
            }}
          >
            <Image
              source={TransactionHistoryIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </TouchableOpacity>
        )}

        {/* Iris Scan Icon */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onIrisScanPress}
          style={{
            width: 24,
            height: 24,
          }}
        >
          <Image
            source={IrisScanIcon}
            className="w-full h-full"
            contentFit="contain"
          />
        </TouchableOpacity>

        {/* Settings Icon */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onSettingsPress}
          style={{
            width: 24,
            height: 24,
          }}
        >
          <Image
            source={SettingsIcon}
            className="w-full h-full"
            contentFit="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};




