/**
 * Assets/NFTs Tab Switcher Component
 * Segmented control for switching between Assets and NFTs views
 * Matches Figma design exactly (node-id: 3279-118732)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const FilterIcon = require("@/assets/home/filter-horizontal.svg");

export type WalletTabKey = "assets" | "nfts";

interface AssetsTabSwitcherProps {
  activeTab: WalletTabKey;
  onTabChange: (tab: WalletTabKey) => void;
  onFilterPress?: () => void;
}

/**
 * Assets/NFTs Tab Switcher - Segmented control with filter button
 */
export const AssetsTabSwitcher: React.FC<AssetsTabSwitcherProps> = ({
  activeTab,
  onTabChange,
  onFilterPress,
}) => {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      {/* Segmented Control */}
      <View
        style={{
          backgroundColor: "#1B1B1B",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderRadius: 50,
          padding: 0,
        }}
      >
        {/* Assets Tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onTabChange("assets")}
          style={{
            height: 35,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 50,
            backgroundColor: activeTab === "assets" ? colors.primaryCTA : "transparent",
            alignItems: "center",
            justifyContent: "center",
            width: 94,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 16,
              color: activeTab === "assets" ? colors.bg : colors.bodyText,
              textAlign: "center",
              letterSpacing: -0.32,
            }}
          >
            Assets
          </Text>
        </TouchableOpacity>

        {/* NFTs Tab */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onTabChange("nfts")}
          style={{
            height: 35,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 50,
            backgroundColor: activeTab === "nfts" ? colors.primaryCTA : "transparent",
            alignItems: "center",
            justifyContent: "center",
            width: 82,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 16,
              color: activeTab === "nfts" ? colors.bg : colors.bodyText,
              textAlign: "center",
              letterSpacing: -0.32,
            }}
          >
            NFTs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onFilterPress}
        style={{
          width: 35,
          height: 35,
          borderRadius: 20,
          backgroundColor: "#1B1B1B",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
          }}
        >
          <Image
            source={FilterIcon}
            className="w-full h-full"
            contentFit="contain"
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};




