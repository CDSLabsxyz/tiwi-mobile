/**
 * Claimable Rewards Card Component
 * Displays claimable rewards amount with expandable arrow
 * Matches Figma design exactly (node-id: 3279-118724)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const StarIcon = require("@/assets/home/star-18.svg");
const ArrowDownIcon = require("@/assets/home/arrow-down-01.svg");

interface ClaimableRewardsCardProps {
  amount: string;
  onPress?: () => void;
}

/**
 * Claimable Rewards Card - Shows rewards amount with expand arrow
 */
export const ClaimableRewardsCard: React.FC<ClaimableRewardsCardProps> = ({
  amount,
  onPress,
}) => {
  return (
    <TouchableOpacity
      className="relative"
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        width: 353,
        borderWidth: 1,
        borderColor: colors.bgStroke,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10.5,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        overflow: "hidden",
        backgroundColor: "transparent", // No background per Figma
      }}
    >
      <View className="pointer-events-none absolute inset-x-4 bottom-0 h-[0.5px] rounded-full bg-[linear-gradient(to_right,rgba(177,241,40,0),rgba(177,241,40,0.95),rgba(177,241,40,0))]"/>
      {/* Left: Star Icon + Text */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
          }}
        >
          <Image
            source={StarIcon}
            className="w-full h-full"
            contentFit="contain"
          />
        </View>
        <Text
          style={{
            fontFamily: "Manrope-Medium",
            fontSize: 14,
            color: colors.bodyText,
            textAlign: "center",
          }}
        >
          <Text>Claimable Rewards: </Text>
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              color: colors.titleText,
            }}
          >
            {amount}
          </Text>
        </Text>
      </View>

      {/* Right: Arrow Icon (rotated) */}
      <View
        style={{
          width: 16,
          height: 16,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: "90deg" }, { scaleY: -1 }],
        }}
      >
        <Image
          source={ArrowDownIcon}
          className="w-full h-full"
          contentFit="contain"
        />
      </View>

      <View className="w-36 h-9 left-[91px] top-[39px] absolute bg-gradient-to-l from-green-500 via-lime-400 to-teal-600 rounded-full blur-2xl"/>
    </TouchableOpacity>
  );
};

