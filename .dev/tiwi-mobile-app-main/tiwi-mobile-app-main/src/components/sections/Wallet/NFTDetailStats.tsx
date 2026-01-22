/**
 * NFT Detail Stats Component
 * Displays NFT statistics (volume, floor price, listed, owners, chain, creation date)
 * Matches Figma design exactly (node-id: 3279-120170)
 */

import React from "react";
import { View, Text } from "react-native";
import { colors } from "@/theme";
import type { NFTDetail } from "@/services/walletService";

interface NFTDetailStatsProps {
  nft: NFTDetail;
}

/**
 * NFT Detail Stats - Grid of statistics
 */
export const NFTDetailStats: React.FC<NFTDetailStatsProps> = ({ nft }) => {
  return (
    <View
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 64,
      }}
    >
      {/* Left Column */}
      <View
        style={{
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 16,
          width: 71,
        }}
      >
        {/* Total Volume */}
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              lineHeight: 22,
              color: colors.titleText,
            }}
          >
            {nft.totalNativeVolume}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
            }}
          >
            Total volume
          </Text>
        </View>

        {/* Owners */}
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            width: 49,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              lineHeight: 22,
              color: colors.titleText,
            }}
          >
            {nft.numberOfOwners.toLocaleString()}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
            }}
          >
            Owners
          </Text>
        </View>
      </View>

      {/* Middle Column */}
      <View
        style={{
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 16,
          width: 78,
        }}
      >
        {/* Floor Price */}
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            width: 62,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              lineHeight: 22,
              color: colors.titleText,
            }}
          >
            {nft.floorPrice}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
            }}
          >
            Floor price
          </Text>
        </View>

        {/* Chain */}
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            width: "100%",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              lineHeight: 22,
              color: colors.titleText,
            }}
          >
            {nft.chain}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
            }}
          >
            Chain
          </Text>
        </View>
      </View>

      {/* Right Column */}
      <View
        style={{
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 16,
          width: 76,
        }}
      >
        {/* Listed Percentage */}
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            width: 48,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              lineHeight: 22,
              color: colors.titleText,
              textAlign: "right",
            }}
          >
            {nft.listedPercentage}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
              textAlign: "right",
            }}
          >
            Listed
          </Text>
        </View>

        {/* Creation Date */}
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            width: "100%",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              lineHeight: 22,
              color: colors.titleText,
            }}
          >
            {nft.creationDate}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              lineHeight: 16,
              color: colors.bodyText,
            }}
          >
            Creation date
          </Text>
        </View>
      </View>
    </View>
  );
};


