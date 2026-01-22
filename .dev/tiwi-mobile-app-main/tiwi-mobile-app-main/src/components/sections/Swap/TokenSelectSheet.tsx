import React from "react";
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { SelectionBottomSheet } from "./SelectionBottomSheet";
import { Image } from "@/tw";
import { colors } from "@/theme";

const TWCIcon = require("@/assets/home/tiwicat-token.svg");
const USDCIcon = require("@/assets/home/coins-02.svg");
const TetherIcon = require("@/assets/home/coins-02-1.svg");
const BNBIcon = require("@/assets/home/coins-01.svg");

export interface TokenOption {
  id: string;
  symbol: string;
  name: string;
  icon: any;
  tvl: string; // e.g. "$1,000,000"
  balanceFiat: string; // "$0"
  balanceToken: string; // "0 TIWI"
}

const TOKEN_OPTIONS: TokenOption[] = [
  {
    id: "twc",
    symbol: "TWC",
    name: "TWC",
    icon: TWCIcon,
    tvl: "$1,000,000",
    balanceFiat: "$0",
    balanceToken: "0 TIWI",
  },
  {
    id: "usdc",
    symbol: "USDC",
    name: "USDC",
    icon: USDCIcon,
    tvl: "$1,000,000",
    balanceFiat: "$0",
    balanceToken: "0 USC",
  },
  {
    id: "tether",
    symbol: "Tether",
    name: "Tether",
    icon: TetherIcon,
    tvl: "$1,000,000",
    balanceFiat: "$0",
    balanceToken: "0 TET",
  },
  {
    id: "bnb",
    symbol: "BNB",
    name: "BNB",
    icon: BNBIcon,
    tvl: "$1,000,000",
    balanceFiat: "$0",
    balanceToken: "0 BSC",
  },
];

import type { ChainId } from "./ChainSelectSheet";

const CheckmarkIcon = require("@/assets/swap/checkmark-circle-01.svg");

interface TokenSelectSheetProps {
  visible: boolean;
  chainId: ChainId;
  selectedTokenId?: string | null;
  onClose: () => void;
  onSelect: (token: TokenOption) => void;
}

/**
 * Token selection bottom sheet
 * Matches Figma token dropdown (node-id: 3279-118111)
 */
export const TokenSelectSheet: React.FC<TokenSelectSheetProps> = ({
  visible,
  chainId,
  selectedTokenId,
  onClose,
  onSelect,
}) => {
  const handleSelect = (token: TokenOption) => {
    onSelect(token);
  };

  return (
    <SelectionBottomSheet
      visible={visible}
      title="Token Selection"
      onClose={onClose}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 24,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {TOKEN_OPTIONS.map((token) => {
          const isActive = token.id === selectedTokenId;

          return (
            <TouchableOpacity
              key={token.id}
              activeOpacity={0.9}
              onPress={() => handleSelect(token)}
              style={{
                height: 76,
                borderRadius: 16,
                backgroundColor: isActive ? colors.bgShade20 : colors.bgSemi,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  height: "100%",
                }}
              >
                {/* Left: icon + symbol + TVL */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                    }}
                  >
                    <Image
                      source={token.icon}
                      className="w-full h-full"
                      contentFit="contain"
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: "column",
                      gap: 4,
                      alignItems: "flex-start",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope-Medium",
                        fontSize: 16,
                        color: colors.titleText,
                      }}
                    >
                      {token.symbol}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope-Medium",
                        fontSize: 12,
                        color: colors.bodyText,
                      }}
                    >
                      {token.tvl}
                    </Text>
                  </View>
                </View>

                {/* Right: balances + checkmark */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Balances */}
                  <View
                    style={{
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                      width: 60,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope-SemiBold",
                        fontSize: 16,
                        color: colors.titleText,
                      }}
                    >
                      {token.balanceFiat}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope-Medium",
                        fontSize: 12,
                        color: colors.bodyText,
                      }}
                    >
                      {token.balanceToken}
                    </Text>
                  </View>

                  {/* Checkmark for selected token */}
                  {isActive && (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                      }}
                    >
                      <Image
                        source={CheckmarkIcon}
                        className="w-full h-full"
                        contentFit="contain"
                      />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SelectionBottomSheet>
  );
};


