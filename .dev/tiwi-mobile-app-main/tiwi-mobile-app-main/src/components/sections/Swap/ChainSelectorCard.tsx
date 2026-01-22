import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const ArrowDown01 = require("../../../assets/home/arrow-down-01.svg");

interface ChainSelectorCardProps {
  chainName: string;
  chainIcon: any;
  onPress?: () => void;
}

/**
 * Chain Selection card
 * Matches Figma block (node-id: 3279-117129)
 */
export const ChainSelectorCard: React.FC<ChainSelectorCardProps> = ({
  chainName,
  chainIcon,
  onPress,
}) => {
  return (
    <View
      style={{
        width: 353,
        height: 99,
        borderRadius: 16,
        backgroundColor: colors.bgSemi,
        paddingHorizontal: 16,
        paddingTop: 16,
      }}
    >
      <Text
        style={{
          fontFamily: "Manrope-Medium",
          fontSize: 14,
          color: colors.titleText,
          textAlign: "left",
        }}
      >
        Chain Selection
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={{
          marginTop: 11,
          height: 40,
          borderRadius: 12,
          backgroundColor: "#273024",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 20,
              height: 20,
              marginRight: 8,
            }}
          >
            <Image
              source={chainIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </View>
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              color: colors.titleText,
            }}
          >
            {chainName}
          </Text>
        </View>

        <Image
          source={ArrowDown01}
          className="w-6 h-6"
          contentFit="contain"
        />
      </TouchableOpacity>
    </View>
  );
};


