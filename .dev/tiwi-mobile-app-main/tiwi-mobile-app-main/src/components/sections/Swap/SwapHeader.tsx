import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "@/tw";
import { colors } from "@/theme";
import { WALLET_ADDRESS, truncateAddress } from "@/utils/wallet";

const TiwiCat = require('@/assets/home/tiwicat.svg');
const ArrowDown01 = require("../../../assets/home/arrow-down-01.svg");
const ArrowLeft02 = require("../../../assets/swap/arrow-left-02.svg");

interface SwapHeaderProps {
  walletAddress?: string;
  onWalletPress?: () => void;
}

/**
 * Swap Header
 * Back arrow + title + wallet identity row
 * Matches swap screen Figma header (node-id: 3279-117096)
 */
export const SwapHeader: React.FC<SwapHeaderProps> = ({
  walletAddress,
  onWalletPress,
}) => {
  const router = useRouter();

  const fullAddress = walletAddress || WALLET_ADDRESS;
  const displayAddress = truncateAddress(fullAddress);

  const handleBack = () => {
    router.back();
  };

  return (
    <View className="w-full px-5 mt-5">
      {/* Top row: back arrow + title */}
      <View className="flex-row items-center justify-between w-[198px]">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          className="w-6 h-6 items-center justify-center"
        >
          <Image
            source={ArrowLeft02}
            className="w-6 h-6"
            contentFit="contain"
            // The exported asset is arrow-right; we flip it horizontally to get arrow-left
            style={{ transform: [{ scaleX: -1 }] }}
          />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Manrope-SemiBold",
            fontSize: 16,
            color: colors.titleText,
            textTransform: "capitalize",
          }}
        >
          Swap
        </Text>
      </View>

      {/* Wallet identity row */}
      <View className="w-full items-center mt-2.5">
        <View className="flex-row items-center justify-center px-2.5">
          {/* Tiwicat icon */}
          <View
            style={{ width: 32, height: 32 }}
            className="mr-2.5"
          >
            <Image
              source={TiwiCat}
              className="w-full h-full"
              contentFit="cover"
            />
          </View>

          {/* Wallet pill */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onWalletPress}
            className="flex-row items-center rounded-full"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6.5,
              backgroundColor: colors.bgSemi,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              {displayAddress}
            </Text>
            <Image
              source={ArrowDown01}
              className="w-4 h-4 ml-2.5"
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};


