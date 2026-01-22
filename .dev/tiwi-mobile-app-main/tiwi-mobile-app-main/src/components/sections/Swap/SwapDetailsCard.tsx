import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Image } from "@/tw";
import { colors } from "@/theme";

const ArrowDown01 = require("@/assets/home/arrow-down-01.svg");

interface SwapDetailsCardProps {
  gasFee?: string;
  slippageTolerance?: string;
  twcFee?: string;
  source?: string[];
  isLoading?: boolean;
}

/**
 * Swap Details Card with expand/collapse animation
 * Always visible - shows default values when no quote, skeleton when loading, actual values when quote available
 * Matches Figma design (node-ids: 3279-124283, 3279-124154)
 * Works for both Swap and Limit tabs
 */
export const SwapDetailsCard: React.FC<SwapDetailsCardProps> = ({
  gasFee,
  slippageTolerance,
  twcFee,
  source,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rotation = useSharedValue(0);
  const height = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.3);

  // Pulsing animation for skeleton loading
  useEffect(() => {
    if (isLoading) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1000 }),
          withTiming(0.3, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      pulseOpacity.value = 0.3;
    }
  }, [isLoading]);

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    
    // Animate rotation (0 = down arrow, 180 = up arrow)
    rotation.value = withTiming(toValue === 1 ? 180 : 0, {
      duration: 300,
    });
    
    // Animate height (0 = collapsed, 1 = expanded)
    height.value = withTiming(toValue, {
      duration: 300,
    });
  };

  // Animated style for arrow rotation
  const arrowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Animated style for content height
  const contentStyle = useAnimatedStyle(() => {
    const expandedHeight = 100;
    const collapsedHeight = 0;
    
    const animatedHeight = interpolate(
      height.value,
      [0, 1],
      [collapsedHeight, expandedHeight],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      height.value,
      [0, 0.3, 1],
      [0, 0, 1],
      Extrapolate.CLAMP
    );

    return {
      height: animatedHeight,
      opacity: opacity,
      overflow: "hidden",
    };
  });

  // Pulsing skeleton style
  const skeletonStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  // Default values when no quote is available
  const displayGasFee = isLoading ? undefined : (gasFee || "$0.00");
  const displaySlippage = isLoading ? undefined : (slippageTolerance || "0%");
  const displayTwcFee = isLoading ? undefined : (twcFee || "$0.00");
  const displaySource = isLoading ? undefined : (source || ["Best", "-"]);

  return (
    <View
      style={{
        width: 353,
        alignSelf: "center",
        marginTop: 12,
        gap: 12,
      }}
    >
      {/* Show More/Less Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggleExpanded}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: 0,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope-SemiBold",
            fontSize: 10,
            color: colors.bodyText,
            lineHeight: 10,
          }}
        >
          {isExpanded ? "Show Less" : "Show More"}
        </Text>
        <Animated.View
          style={[
            {
              width: 16,
              height: 16,
            },
            arrowStyle,
          ]}
        >
          <Image
            source={ArrowDown01}
            className="w-full h-full"
            contentFit="contain"
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Details Card - Animated */}
      <Animated.View
        style={[
          {
            width: "100%",
            backgroundColor: colors.bgStroke,
            borderRadius: 12,
            padding: 12,
            overflow: "hidden",
          },
          contentStyle,
        ]}
      >
        <View
          style={{
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          {/* Gas Fee */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-SemiBold",
                fontSize: 10,
                color: colors.bodyText,
                lineHeight: 10,
              }}
            >
              Gas Fee
            </Text>
            {isLoading ? (
              <Animated.View
                style={[
                  {
                    width: 60,
                    height: 10,
                    borderRadius: 4,
                    backgroundColor: colors.bgCards,
                  },
                  skeletonStyle,
                ]}
              />
            ) : (
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 10,
                  color: colors.primaryCTA,
                  lineHeight: 10,
                  textAlign: "right",
                }}
              >
                {displayGasFee}
              </Text>
            )}
          </View>

          {/* Source */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-SemiBold",
                fontSize: 10,
                color: colors.bodyText,
                lineHeight: 10,
              }}
            >
              Source
            </Text>
            {isLoading ? (
              <Animated.View
                style={[
                  {
                    width: 80,
                    height: 10,
                    borderRadius: 4,
                    backgroundColor: colors.bgCards,
                  },
                  skeletonStyle,
                ]}
              />
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 0,
                }}
              >
                {displaySource && displaySource.map((item, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: item === "Best" ? colors.accentDark40 : "transparent",
                      borderColor: item === "TWC" ? colors.primaryCTA : colors.accentDark40,
                      borderWidth: item === "TWC" ? 0.25 : 0.5,
                      borderLeftWidth: item === "TWC" ? 0 : 0.5,
                      borderRightWidth: item === "Best" ? 0 : 0.25,
                      borderTopLeftRadius: item === "Best" ? 2 : 0,
                      borderBottomLeftRadius: item === "Best" ? 2 : 0,
                      borderTopRightRadius: item === "TWC" ? 2 : 0,
                      borderBottomRightRadius: item === "TWC" ? 2 : 0,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope-Medium",
                        fontSize: 8,
                        color: colors.primaryCTA,
                        lineHeight: 8,
                        textAlign: "right",
                      }}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Slippage Tolerance */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-SemiBold",
                fontSize: 10,
                color: colors.bodyText,
                lineHeight: 10,
              }}
            >
              Slippage Tolerance
            </Text>
            {isLoading ? (
              <Animated.View
                style={[
                  {
                    width: 40,
                    height: 10,
                    borderRadius: 4,
                    backgroundColor: colors.bgCards,
                  },
                  skeletonStyle,
                ]}
              />
            ) : (
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 10,
                  color: colors.primaryCTA,
                  lineHeight: 10,
                  textAlign: "right",
                }}
              >
                {displaySlippage}
              </Text>
            )}
          </View>

          {/* TWC Fee */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-SemiBold",
                fontSize: 10,
                color: colors.bodyText,
                lineHeight: 10,
              }}
            >
              TWC Fee
            </Text>
            {isLoading ? (
              <Animated.View
                style={[
                  {
                    width: 60,
                    height: 10,
                    borderRadius: 4,
                    backgroundColor: colors.bgCards,
                  },
                  skeletonStyle,
                ]}
              />
            ) : (
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 10,
                  color: colors.primaryCTA,
                  lineHeight: 10,
                  textAlign: "right",
                }}
              >
                {displayTwcFee}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};
