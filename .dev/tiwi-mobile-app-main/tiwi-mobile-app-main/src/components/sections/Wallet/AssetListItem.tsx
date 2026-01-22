/**
 * Asset List Item Component
 * Displays individual asset with icon, name, chart, balance, and USD value
 * Matches Figma design exactly (node-id: 3279-118747)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";
import type { PortfolioItem } from "@/services/walletService";

interface AssetListItemProps {
  asset: PortfolioItem;
  onPress?: () => void;
}

/**
 * Asset List Item - Individual asset row in the portfolio list
 */
export const AssetListItem: React.FC<AssetListItemProps> = ({
  asset,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        width: "100%",
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: Icon + Symbol/Name */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          width: 142,
        }}
      >
        {/* Asset Icon */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <Image
            source={{ uri: asset.logo }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </View>

        {/* Symbol + Name */}
        <View
          style={{
            flex: 1,
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {/* Symbol */}
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              lineHeight: 20,
              color: colors.titleText,
            }}
          >
            {asset.symbol}
          </Text>

          {/* Name */}
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 20,
              color: "#8A929A",
            }}
            numberOfLines={1}
          >
            {asset.name}
          </Text>
        </View>
      </View>

      {/* Center: Price Chart (Placeholder) */}
      <View
        style={{
          width: 70,
          height: 32,
          alignItems: "center",
          justifyContent: "center",
          marginHorizontal: 0,
        }}
      >
        {asset.chartData ? (
          <Image
            source={{ uri: asset.chartData }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: colors.bgStroke,
              borderRadius: 4,
            }}
          />
        )}
      </View>

      {/* Right: Balance + USD Value */}
      <View
        style={{
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 2,
          minWidth: 120,
          maxWidth: 120,
        }}
      >
        {/* Balance Amount */}
        <Text
          style={{
            fontFamily: "Manrope-Medium",
            fontSize: 14,
            lineHeight: 20,
            color: colors.titleText,
            textAlign: "right",
          }}
          numberOfLines={1}
          adjustsFontSizeToFit={false}
        >
          {(() => {
            // Parse the balance number and round it to fit within the width
            const balanceNum = parseFloat(asset.balance.replace(/,/g, ''));
            if (isNaN(balanceNum)) return asset.balance;
            
            // Try different decimal places until it fits
            let decimals = 8;
            let formatted = balanceNum.toFixed(decimals);
            
            // Remove trailing zeros
            formatted = formatted.replace(/\.?0+$/, '');
            
            // If still too long, reduce decimals progressively
            while (formatted.length > 12 && decimals > 0) {
              decimals--;
              formatted = balanceNum.toFixed(decimals).replace(/\.?0+$/, '');
            }
            
            // Add thousand separators if needed
            const parts = formatted.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return parts.length > 1 ? parts.join('.') : parts[0];
          })()}
        </Text>

        {/* USD Value */}
        <Text
          style={{
            fontFamily: "Manrope-Regular",
            fontSize: 12,
            lineHeight: 20,
            color: "#8A929A",
            textAlign: "right",
          }}
        >
          {asset.usdValue}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

