/**
 * Asset Detail Header Component
 * Displays asset logo, name, balance, USD value, and price change
 * Matches Figma design exactly (node-id: 3279-120251)
 */

import React from "react";
import { View, Text } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";
import type { AssetDetail } from "@/services/walletService";

interface AssetDetailHeaderProps {
  asset: AssetDetail;
}

/**
 * Asset Detail Header - Logo, name, balance, USD value, and price change
 */
export const AssetDetailHeader: React.FC<AssetDetailHeaderProps> = ({
  asset,
}) => {
  const isPositive = asset.change24h >= 0;
  const changeColor = isPositive ? "#34c759" : colors.error;

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      {/* Logo and Name */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Asset Logo */}
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 16,
            backgroundColor: "#333",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: asset.logo }}
            style={{
              width: "100%",
              height: "100%",
            }}
            contentFit="cover"
          />
        </View>

        {/* Asset Name */}
        <Text
          style={{
            fontFamily: "Manrope-Regular",
            fontSize: 16,
            lineHeight: 20,
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          {asset.name}
        </Text>
      </View>

      {/* Balance */}
      <Text
        style={{
          fontFamily: "Manrope-Medium",
          fontSize: 24,
          lineHeight: 28,
          color: colors.titleText,
          textTransform: "capitalize",
        }}
      >
        {asset.balance}
      </Text>

      {/* USD Value and Price Change */}
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        {/* USD Value */}
        <Text
          style={{
            fontFamily: "Manrope-Regular",
            fontSize: 16,
            lineHeight: 20,
            color: "#8A929A",
          }}
        >
          {asset.usdValue}
        </Text>

        {/* Price Change */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          {/* Change Badge */}
          <View
            style={{
              backgroundColor: isPositive
                ? "rgba(221, 251, 228, 0.2)"
                : "rgba(255, 92, 92, 0.2)",
              borderRadius: 100,
              padding: 2,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                transform: [{ scaleY: isPositive ? -1 : 1 }],
              }}
            >
              <Image
                source={{
                  uri: "https://www.figma.com/api/mcp/asset/e98ecbc4-eb56-454c-bc82-aabeaf730680",
                }}
                style={{
                  width: 12,
                  height: 12,
                }}
                contentFit="contain"
              />
            </View>
          </View>

          {/* Change Percentage */}
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 14,
              lineHeight: 16,
              color: changeColor,
              letterSpacing: -0.14,
            }}
          >
            {asset.change24hAmount}
          </Text>

          {/* Period Label */}
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
            }}
          >
            Today
          </Text>
        </View>
      </View>
    </View>
  );
};


