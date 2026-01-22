/**
 * Asset Detail Activities Component
 * Displays recent activities/transactions for the asset
 * Matches Figma design exactly (node-id: 3279-120307)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "@/theme";
import type { AssetActivity } from "@/services/walletService";

interface AssetDetailActivitiesProps {
  activities: AssetActivity[];
  onViewAllPress?: () => void;
}

/**
 * Asset Detail Activities - List of recent activities
 */
export const AssetDetailActivities: React.FC<AssetDetailActivitiesProps> = ({
  activities,
  onViewAllPress,
}) => {
  if (activities.length === 0) {
    return (
      <View
        style={{
          width: "100%",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope-Bold",
            fontSize: 14,
            lineHeight: 21,
            color: colors.bodyText,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Recent Activities
        </Text>
        <Text
          style={{
            fontFamily: "Manrope-Regular",
            fontSize: 14,
            lineHeight: 20,
            color: colors.bodyText,
          }}
        >
          No activities yet
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Section Header */}
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope-Bold",
            fontSize: 14,
            lineHeight: 21,
            color: colors.bodyText,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Recent Activities
        </Text>
        {onViewAllPress && (
          <TouchableOpacity activeOpacity={0.8} onPress={onViewAllPress}>
            <Text
              style={{
                fontFamily: "Manrope-Regular",
                fontSize: 12,
                lineHeight: 18,
                color: colors.bodyText,
                textTransform: "capitalize",
              }}
            >
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Activities List */}
      <View
        style={{
          width: "100%",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {activities.map((activity) => {
          const isReceived = activity.type === "received";
          const amountColor = isReceived ? "#498F00" : colors.titleText;

          return (
            <View
              key={activity.id}
              style={{
                width: "100%",
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              {/* Left: Type and Date */}
              <View
                style={{
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                  width: 97,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Bold",
                    fontSize: 14,
                    lineHeight: 21,
                    color: colors.titleText,
                    textTransform: "capitalize",
                  }}
                >
                  {activity.type}
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 12,
                    lineHeight: 18,
                    color: colors.bodyText,
                  }}
                >
                  {activity.date}
                </Text>
              </View>

              {/* Right: Amount and USD Value */}
              <View
                style={{
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                  width: 129,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 14,
                    lineHeight: 21,
                    color: amountColor,
                    textAlign: "right",
                    textTransform: "uppercase",
                  }}
                >
                  {activity.amount}
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 12,
                    lineHeight: 18,
                    color: colors.bodyText,
                    textAlign: "right",
                    textTransform: "uppercase",
                  }}
                >
                  {activity.usdValue}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};


