/**
 * Send Token Selector Component
 * Displays selected token or placeholder for selection
 * Matches Figma design (node-id: 3279-118948)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/constants";
import { useSendStore } from "@/store/sendStore";

const ArrowDownIcon = require("@/assets/home/arrow-down-01.svg");

interface SendTokenSelectorProps {
  onTokenPress: () => void;
}

export const SendTokenSelector: React.FC<SendTokenSelectorProps> = ({ onTokenPress }) => {
  const { selectedToken, selectedChain } = useSendStore();

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 14,
        flex: 1,
      }}
    >
      {/* Token Selection Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onTokenPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          backgroundColor: colors.bgCards,
          borderRadius: 50,
          borderTopLeftRadius: 50,
          borderTopRightRadius: 50,
          borderBottomLeftRadius: 50,
          borderBottomRightRadius: 50,
          // paddingLeft: 9,
          paddingRight: 9,
          paddingVertical: 0,
          height: 57,
          minHeight: 57,
          flexShrink: 1,
          // flex: 1,
          maxWidth: 230,
          width: "100%",
          justifyContent: selectedToken ? "flex-start" : "space-between",
        }}
      >
        {selectedToken ? (
          <>
            {/* Token Icon with Chain Badge */}
            <View
              style={{
                // width: 57,
                // height: 57,
                position: "relative",
                flexShrink: 0,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 50,
                  backgroundColor: colors.bgStroke,
                  borderWidth: 1,
                  borderColor: colors.bodyText,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  // marginTop: 10,
                }}
              >
                <Image
                  source={selectedToken.icon}
                  className="w-full h-full"
                  contentFit="cover"
                />
              </View>
              {selectedChain && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.bgStroke,
                    borderWidth: 1,
                    borderColor: colors.bodyText,
                    overflow: "hidden",
                  }}
                >
                  <Image
                    source={selectedChain.icon}
                    className="w-full h-full"
                    contentFit="cover"
                  />
                </View>
              )}
            </View>

            {/* Token Info */}
            <View
              style={{
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: 0,
                flexShrink: 1,
                minWidth: 0,
                flex: 1,
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 18,
                  lineHeight: 24,
                  color: colors.bodyText,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedToken.symbol}
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.bodyText,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedChain?.name || selectedToken.name}
              </Text>
            </View>

            {/* Arrow */}
            <View
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
              }}
            >
              <Image
                source={ArrowDownIcon}
                className="w-full h-full"
                contentFit="contain"
              />
            </View>
          </>
        ) : (
          <>
            <Text
              style={{
                fontFamily: "Manrope-Regular",
                fontSize: 14,
                color: colors.bodyText,
                flex: 1,
                textAlign: "left",
                paddingLeft: 9,
              }}
            >
              Select Asset
            </Text>
            <View
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
              }}
            >
              <Image
                source={ArrowDownIcon}
                className="w-full h-full"
                contentFit="contain"
              />
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Balance Display - Takes most space and grows */}
      <View
        style={{
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4,
          flex: 1,
          minWidth: 77,
          flexShrink: 0,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope-Medium",
            fontSize: 18,
            lineHeight: 24,
            color: colors.bodyText,
            textTransform: "uppercase",
            textAlign: "right",
          }}
          numberOfLines={1}
          adjustsFontSizeToFit={false}
        >
          {selectedToken ? selectedToken.balanceToken.split(" ")[0] : "0.00"}
        </Text>
        <Text
          style={{
            fontFamily: "Manrope-Medium",
            fontSize: 12,
            lineHeight: 18,
            color: colors.bodyText,
            textTransform: "uppercase",
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {selectedToken ? selectedToken.balanceFiat : "$0.00"}
        </Text>
      </View>
    </View>
  );
};


