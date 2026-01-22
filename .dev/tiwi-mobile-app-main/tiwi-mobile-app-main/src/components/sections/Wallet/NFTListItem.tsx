/**
 * NFT List Item Component
 * Displays individual NFT card in the grid view
 * Matches Figma design exactly (node-id: 3279-120042)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";
import type { NFTItem } from "@/services/walletService";

interface NFTListItemProps {
  nft: NFTItem;
  onPress?: () => void;
}

/**
 * NFT List Item - Individual NFT card in the grid
 * Dimensions: 175px × 210px
 */
export const NFTListItem: React.FC<NFTListItemProps> = ({
  nft,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        width: 175,
        height: 210,
        backgroundColor: colors.bgSemi,
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* NFT Image */}
      <View
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
      >
        <Image
          source={{ uri: nft.mediaUrl }}
          style={{
            width: "100%",
            height: "100%",
          }}
          contentFit="cover"
        />
      </View>

      {/* Bottom Overlay with Name and Floor Price */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 45,
          backgroundColor: "rgba(27, 27, 27, 0.25)",
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left: Name and Floor Price */}
        <View
          style={{
            flex: 1,
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 0,
          }}
        >
          {/* NFT Name */}
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              lineHeight: 18,
              color: colors.titleText,
            }}
            numberOfLines={1}
          >
            {nft.name}
          </Text>

          {/* Floor Price */}
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: "rgba(255, 255, 255, 0.75)",
            }}
          >
            Floor: {nft.floorPrice}
          </Text>
        </View>

        {/* Right: Arrow Icon */}
        <View
          style={{
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{
              uri: "https://www.figma.com/api/mcp/asset/252d40cb-9274-457c-b987-3c8fe59ac90d",
            }}
            style={{
              width: 24,
              height: 24,
            }}
            contentFit="contain"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};


