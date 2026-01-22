/**
 * Total Balance Card Component
 * Displays total balance with visibility toggle and portfolio change
 * Matches Figma design exactly (node-id: 3279-118684)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const ViewIcon = require("@/assets/home/view.svg");

interface TotalBalanceCardProps {
  totalBalance: string;
  portfolioChange: {
    amount: string;
    percent: string;
    period: string;
  };
  isBalanceVisible: boolean;
  onToggleVisibility: () => void;
  onTodayPress?: () => void;
}

/**
 * Total Balance Card - Shows balance, change, and visibility toggle
 */
export const TotalBalanceCard: React.FC<TotalBalanceCardProps> = ({
  totalBalance,
  portfolioChange,
  isBalanceVisible,
  onToggleVisibility,
  onTodayPress,
}) => {
  return (
    <View
      style={{
        width: "100%",
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        overflow: "hidden",
        backgroundColor: "transparent", // No background per Figma
      }}
    >
      <View
        style={{
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        {/* Label + View Icon */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 12,
              color: colors.bodyText,
            }}
          >
            Total Balance
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggleVisibility}
            style={{
              width: 14,
              height: 14,
            }}
          >
            <Image
              source={ViewIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Balance Amount */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Bold",
              fontSize: 32,
              color: colors.titleText,
              textAlign: "center",
            }}
          >
            {isBalanceVisible ? totalBalance : "****"}
          </Text>
        </View>

        {/* Portfolio Change */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 14,
              lineHeight: 26,
              color: colors.success,
            }}
          >
            {portfolioChange.amount} ({portfolioChange.percent})
          </Text>
          <TouchableOpacity activeOpacity={0.8} onPress={onTodayPress}>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 14,
                lineHeight: 22,
                color: "#9DA4AE",
                textDecorationLine: "underline",
              }}
            >
              {portfolioChange.period}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

