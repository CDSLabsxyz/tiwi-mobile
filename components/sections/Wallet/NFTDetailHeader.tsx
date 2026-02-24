/**
 * NFT Detail Header Component
 * Displays NFT name, creator, and favorite button
 * Matches Figma design exactly (node-id: 3279-120160)
 */

import { colors } from "@/constants/colors";
import type { NFTDetail } from "@/services/walletService";
import { Image } from "expo-image";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface NFTDetailHeaderProps {
  nft: NFTDetail;
  isFavorite?: boolean;
  onFavoritePress?: () => void;
}

/**
 * NFT Detail Header - Name, creator, and favorite button
 */
export const NFTDetailHeader: React.FC<NFTDetailHeaderProps> = ({
  nft,
  isFavorite = false,
  onFavoritePress,
}) => {
  return (
    <View
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }}
    >
      {/* Left: Name and Creator */}
      <View
        style={{
          flex: 1,
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 4,
        }}
      >
        {/* Name with Verification Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 18,
              lineHeight: 24,
              color: colors.titleText,
            }}
          >
            {nft.name}
          </Text>
          {nft.isVerified && (
            <View
              style={{
                width: 16,
                height: 16,
              }}
            >
              <Image
                source={{
                  uri: "https://www.figma.com/api/mcp/asset/33ccc2e8-7e71-47e1-818c-ba7f3e697c59",
                }}
                style={{
                  width: 16,
                  height: 16,
                }}
                contentFit="contain"
              />
            </View>
          )}
        </View>

        <Text
          style={{
            fontFamily: "Manrope-Regular",
            fontSize: 16,
            lineHeight: 20,
            color: colors.bodyText,
          }}
        >
          <Text style={{ fontFamily: "Manrope-Regular" }}>By </Text>
          {nft.createdBy || 'Unknown Creator'}
        </Text>
      </View>

      {/* Right: Favorite Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onFavoritePress}
        style={{
          width: 20,
          height: 20,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={{
            uri: "https://www.figma.com/api/mcp/asset/6b28a9ab-4d89-4d74-9a58-fd6ebd1bfaaa",
          }}
          style={{
            width: 20,
            height: 20,
            opacity: isFavorite ? 1 : 0.5,
          }}
          contentFit="contain"
        />
      </TouchableOpacity>
    </View>
  );
};


