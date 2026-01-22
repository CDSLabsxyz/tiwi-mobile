import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, TextInput, Dimensions } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const WalletIcon = require("../../../assets/home/wallet-03.svg");
const ArrowDown01 = require("../../../assets/home/arrow-down-01.svg");
const TiwicatToken = require("../../../assets/home/tiwicat-token.svg");
const ChainBadge = require("../../../assets/home/chains/bsc.svg");

export type SwapTokenVariant = "from" | "to";

interface SwapTokenCardProps {
  variant: SwapTokenVariant;
  tokenSymbol?: string;
  tokenChain?: string;
  tokenSelected: boolean;
  tokenIcon?: any; // Token logo
  chainBadgeIcon?: any; // Chain badge icon
  amount: string;
  fiatAmount: string;
  balanceText: string;
  onAmountChange?: (value: string) => void;
  onTokenPress?: () => void;
  onMaxPress?: () => void;
  isLoadingQuote?: boolean; // Show skeleton UI while fetching quote
}

/**
 * Token amount card (From / To)
 * Exact 1:1 match with Figma design (node-ids: 3279-117141, 3279-117165)
 * All measurements, spacing, and typography match Figma dev mode specs
 */
export const SwapTokenCard: React.FC<SwapTokenCardProps> = ({
  variant,
  tokenSymbol,
  tokenChain,
  tokenSelected,
  tokenIcon,
  chainBadgeIcon,
  amount,
  fiatAmount,
  balanceText,
  onAmountChange,
  onTokenPress,
  onMaxPress,
  isLoadingQuote = false,
}) => {
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const isFrom = variant === "from";
  const label = isFrom ? "From" : "To";

  // Calculate dynamic width based on screen size
  const cardWidth = Math.min(353, SCREEN_WIDTH - 40); // 40px padding from screen edges
  const rightSectionWidth = cardWidth * 0.4; // Right section takes ~40% of width
  const leftSectionWidth = cardWidth * 0.6; // Left section takes ~60% of width

  const handleAmountChange = (value: string) => {
    // Only allow numbers and a single decimal point
    // Remove any non-numeric characters except decimal point
    let sanitized = value.replace(/[^0-9.]/g, "");
    
    // Prevent multiple decimal points
    const parts = sanitized.split(".");
    if (parts.length > 2) {
      // If more than one decimal point, keep only the first one
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
    
    console.log("🔤 Input Sanitization:", {
      variant: variant,
      rawInput: value,
      sanitizedOutput: sanitized,
      willCallOnAmountChange: !!onAmountChange,
    });
    
    onAmountChange?.(sanitized);
  };

  const displayTokenSymbol = useMemo(() => tokenSymbol ?? (isFrom ? "TWC" : ""), [tokenSymbol, isFrom]);
  const displayTokenChain = useMemo(
    () => tokenChain ?? (isFrom ? "Ethereum" : ""),
    [tokenChain, isFrom]
  );
  
  // Use provided icons or fallback to defaults
  const displayTokenIcon = useMemo(() => tokenIcon ?? TiwicatToken, [tokenIcon]);
  const displayChainBadge = useMemo(() => chainBadgeIcon ?? ChainBadge, [chainBadgeIcon]);

  return (
    <View
      style={{
        width: cardWidth,
        borderRadius: isFrom ? 12 : 10.232,
        backgroundColor: colors.bgSemi,
        padding: 16,
        overflow: "hidden",
      }}
    >
      {/* Main Container with proper spacing */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Left: Token selector section (60% of width) */}
        <View
          style={{
            width: leftSectionWidth - 32, // Account for padding
            flexDirection: "column",
            gap: isFrom ? 6 : 8.313,
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          {/* Label: "From" or "To" */}
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 10,
              color: colors.titleText,
              lineHeight: 10,
            }}
          >
            {label}
          </Text>

          {isFrom ? (
            /* From: Token selection pill */
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onTokenPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 6,
                paddingHorizontal: 5,
                paddingVertical: 5,
                borderRadius: 63.949,
                backgroundColor: colors.bgCards,
                // minWidth: 10,
                // maxWidth: leftSectionWidth - 40,
              }}
            >
              {/* Composite token avatar */}
              <View
                style={{
                  width: 32,
                  height: 32,
                  position: "relative",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 30.696,
                    height: 30.696,
                  }}
                >
                  <Image
                    source={displayTokenIcon}
                    className="w-full h-full"
                    contentFit="cover"
                  />
                </View>
                <View
                  style={{
                    position: "absolute",
                    bottom: -0.32,
                    right: 0,
                    width: 15.348,
                    height: 15.348,
                    overflow: "visible",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      top: -15.348 * 0.0833,
                      left: -15.348 * 0.0833,
                      right: -15.348 * 0.0833,
                      bottom: -15.348 * 0.0833,
                      width: 15.348 * 1.1666,
                      height: 15.348 * 1.1666,
                    }}
                  >
                    <Image
                      source={displayChainBadge}
                      className="w-full h-full"
                      contentFit="cover"
                    />
                  </View>
                </View>
              </View>

              {/* Token symbol + chain text */}
              <View
                style={{
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 0,
                  flexShrink: 1,
                  minWidth: 60,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-SemiBold",
                    fontSize: 12,
                    color: colors.titleText,
                    lineHeight: 12,
                    textAlign: "left",
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayTokenSymbol}
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 10,
                    color: colors.mutedText,
                    lineHeight: 10,
                    textAlign: "left",
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayTokenChain}
                </Text>
              </View>

              {/* Dropdown arrow */}
              <View
                style={{
                  width: 15.348,
                  height: 15.348,
                //   marginLeft: 'auto',
                }}
              >
                <Image
                  source={ArrowDown01}
                  className="w-full h-full"
                  contentFit="contain"
                />
              </View>
            </TouchableOpacity>
          ) : (
            /* To: Show selected token pill or "Select Token" button */
            tokenSelected && displayTokenIcon ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onTokenPress}
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 6,
                  paddingHorizontal: 5,
                  paddingVertical: 5,
                  borderRadius: 63.949,
                  backgroundColor: colors.bgCards,
                }}
              >
                {/* Composite token avatar */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    position: "relative",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: 30.696,
                      height: 30.696,
                    }}
                  >
                    <Image
                      source={displayTokenIcon}
                      className="w-full h-full"
                      contentFit="cover"
                    />
                  </View>
                  {displayChainBadge && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: -0.32,
                        right: 0,
                        width: 15.348,
                        height: 15.348,
                        overflow: "visible",
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          top: -15.348 * 0.0833,
                          left: -15.348 * 0.0833,
                          right: -15.348 * 0.0833,
                          bottom: -15.348 * 0.0833,
                          width: 15.348 * 1.1666,
                          height: 15.348 * 1.1666,
                        }}
                      >
                        <Image
                          source={displayChainBadge}
                          className="w-full h-full"
                          contentFit="cover"
                        />
                      </View>
                    </View>
                  )}
                </View>

                <View
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 0,
                    flexShrink: 1,
                    minWidth: 60,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 12,
                      color: colors.titleText,
                      lineHeight: 12,
                      textAlign: "left",
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {displayTokenSymbol}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 10,
                      color: colors.mutedText,
                      lineHeight: 10,
                      textAlign: "left",
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {displayTokenChain}
                  </Text>
                </View>

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
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onTokenPress}
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5.755,
                  height: 32,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: colors.accentDark40,
                  minWidth: 130,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 12,
                    color: colors.titleText,
                    lineHeight: 12,
                    textAlign: "left",
                  }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
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
            )
          )}
        </View>

        {/* Right: Amount section (40% of width) */}
        <View
          style={{
            width: rightSectionWidth,
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {/* Top row: Wallet icon + Balance + Max button */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              width: "100%",
              marginBottom: 4,
            }}
          >
            {/* Wallet icon + Balance */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                flexShrink: 1,
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
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {balanceText}
              </Text>
            </View>

            {/* Max button - only for From card */}
            {isFrom && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onMaxPress}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 63.949,
                  backgroundColor: colors.bgStroke,
                  minWidth: 40,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 8,
                    color: colors.primaryCTA,
                    lineHeight: 8,
                    textAlign: "center",
                  }}
                >
                  Max
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Amount Input Field */}
          <View
            style={{
              width: "100%",
              alignItems: "flex-end",
            }}
          >
            {isLoadingQuote ? (
              <View
              className="animate-pulse"
                style={{
                  width: 120,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: colors.bgStroke,
                }}
              />
            ) : (
              <TextInput
                value={amount}
                onChangeText={handleAmountChange}
                editable={isFrom} // TO variant is read-only
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="0.0"
                placeholderTextColor={colors.mutedText}
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 20,
                  color: colors.titleText,
                  textAlign: "right",
                  padding: 0,
                  width: "100%",
                  minHeight: 24,
                }}
                textAlign="right"
                numberOfLines={1}
                returnKeyType="done"
              />
            )}
          </View>

          {/* Fiat Amount */}
          <View
            style={{
              width: "100%",
              alignItems: "flex-end",
            }}
          >
            {isLoadingQuote ? (
              <View
              className="animate-pulse"
                style={{
                  width: 80,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: colors.bgStroke,
                }}
              />
            ) : (
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 10,
                  color: colors.mutedText,
                  lineHeight: 10,
                  textAlign: "right",
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {fiatAmount}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};