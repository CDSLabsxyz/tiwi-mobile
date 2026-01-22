import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "@/theme";

export type SwapTabKey = "swap" | "limit";

interface SwapTabsProps {
  activeTab: SwapTabKey;
  onChange: (tab: SwapTabKey) => void;
}

/**
 * Swap / Limit segmented control
 * Visually matches Figma (node-id: 3279-123135)
 */
export const SwapTabs: React.FC<SwapTabsProps> = ({ activeTab, onChange }) => {
  const handlePress = (tab: SwapTabKey) => {
    if (tab === activeTab) return;
    onChange(tab);
  };

  return (
    <View
      className="w-full items-center mt-5"
    >
      <View
        className="flex-row items-center rounded-full"
        style={{
          width: 353,
          padding: 4,
          backgroundColor: colors.bgSemi,
        }}
      >
        {/* Swap tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handlePress("swap")}
          className="items-center justify-center rounded-full border"
          style={{
            width: 168,
            height: 35,
            backgroundColor:
              activeTab === "swap" ? "#141E00" : "transparent",
            borderColor:
              activeTab === "swap" ? colors.primaryCTA : "transparent",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              color: activeTab === "swap" ? colors.primaryCTA : colors.mutedHiddenText,
            }}
          >
            Swap
          </Text>
        </TouchableOpacity>

        {/* Limit tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handlePress("limit")}
          className="items-center justify-center rounded-full border"
          style={{
            width: 168,
            height: 35,
            backgroundColor:
              activeTab === "limit" ? "#141E00" : "transparent",
            borderColor:
              activeTab === "limit" ? colors.primaryCTA : "transparent",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              color: activeTab === "limit" ? colors.primaryCTA : colors.mutedHiddenText,
            }}
          >
            Limit
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};


