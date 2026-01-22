import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, Dimensions } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const WalletIcon = require("../../../assets/home/wallet-03.svg");
const ArrowDown01 = require("../../../assets/home/arrow-down-01.svg");
const TetherIcon = require("../../../assets/home/coins-02-1.svg");

interface LimitWhenPriceCardProps {
  tokenSymbol?: string;
  tokenSelected: boolean;
  tokenIcon?: any;
  amount: string;
  fiatAmount: string;
  balanceText: string;
  onAmountChange?: (value: string) => void;
  onTokenPress?: () => void;
}

/**
 * When Price card for Limit tab
 * Exact 1:1 match with Figma design (node-id: 3279-123817)
 * Height: 96.545px, matches Figma specs
 */
export const LimitWhenPriceCard: React.FC<LimitWhenPriceCardProps> = ({
  tokenSymbol,
  tokenSelected,
  tokenIcon,
  amount,
  fiatAmount,
  balanceText,
  onAmountChange,
  onTokenPress,
}) => {
  const { width: SCREEN_WIDTH } = Dimensions.get("window");
  const cardWidth = Math.min(353, SCREEN_WIDTH - 40);

  const handleAmountChange = (value: string) => {
    // Only allow numbers and a single decimal point
    let sanitized = value.replace(/[^0-9.]/g, "");
    
    // Prevent multiple decimal points
    const parts = sanitized.split(".");
    if (parts.length > 2) {
      sanitized = parts[0] + "." + parts.slice(1).join("");
    }
    
    // Prevent leading zeros (except 0.xxx)
    if (sanitized.length > 1 && sanitized[0] === "0" && sanitized[1] !== ".") {
      sanitized = sanitized.substring(1);
    }
    
    // Prevent decimal point at the start
    if (sanitized === ".") {
      sanitized = "0.";
    }
    
    onAmountChange?.(sanitized);
  };

  const displayTokenIcon = useMemo(() => tokenIcon ?? TetherIcon, [tokenIcon]);
  const displayTokenSymbol = useMemo(() => tokenSymbol ?? "Tether", [tokenSymbol]);

  return (
    <View
      style={{
        width: cardWidth,
        height: 96.545,
        borderRadius: 10.232,
        backgroundColor: colors.bgStroke,
        padding: 16,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          gap: 86.971,
        }}
      >
        {/* Left: Token selector section */}
        <View
          style={{
            flexDirection: "column",
            gap: 8.313,
            alignItems: "flex-start",
            justifyContent: "center",
            width: 120.58,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 10,
              color: colors.titleText,
              lineHeight: 10,
            }}
          >
            When Price
          </Text>
          
          {tokenSelected ? (
            /* Token selection pill with icon + symbol */
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onTokenPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
                paddingHorizontal: 5.116,
                paddingVertical: 5.116,
                borderRadius: 63.949,
                backgroundColor: colors.bgCards,
              }}
            >
              {/* Token icon */}
              <View
                style={{
                  width: 32,
                  height: 32,
                }}
              >
                <Image
                  source={displayTokenIcon}
                  className="w-full h-full"
                  contentFit="cover"
                />
              </View>

              {/* Token symbol */}
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 12,
                  color: colors.titleText,
                  lineHeight: 12,
                }}
              >
                {displayTokenSymbol}
              </Text>
            </TouchableOpacity>
          ) : (
            /* Select Token button */
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onTokenPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5.755,
                height: 32,
                paddingHorizontal: 10.232,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: colors.accentDark40,
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 12,
                  color: colors.titleText,
                }}
              >
                Select Token
              </Text>
              <View
                style={{
                  width: 15.348,
                  height: 15.348,
                }}
              >
                <Image
                  source={ArrowDown01}
                  className="w-full h-full"
                  contentFit="contain"
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Right: Amount section */}
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            width: 113.449,
          }}
        >
          {/* Balance row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              height: 20.464,
              width: "100%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 1.279,
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                }}
              >
                <Image
                  source={WalletIcon}
                  className="w-full h-full"
                  contentFit="contain"
                />
              </View>
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 10,
                  color: colors.bodyText,
                  lineHeight: 10,
                  textAlign: "right",
                }}
              >
                {balanceText}
              </Text>
            </View>
          </View>

          {/* Amount Input Field */}
          <View
            style={{
              width: "100%",
              alignItems: "flex-end",
            }}
          >
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0.0"
              placeholderTextColor={colors.mutedText}
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 20,
                color: amount ? colors.titleText : colors.mutedText,
                textAlign: "right",
                padding: 0,
                width: "100%",
                minHeight: 24,
              }}
              textAlign="right"
              numberOfLines={1}
              returnKeyType="done"
            />
          </View>

          {/* Fiat amount */}
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 10,
              color: colors.mutedText,
              lineHeight: 10,
              textAlign: "right",
            }}
          >
            {fiatAmount}
          </Text>
        </View>
      </View>
    </View>
  );
};

