/**
 * Asset Detail Activities Component
 * Displays recent activities/transactions for the asset
 * Matches Figma design exactly (node-id: 3279-120307)
 */

import { colors } from "@/constants/colors";
import type { AssetActivity } from "@/services/walletService";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

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
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 2,
              }}
            >
              {/* Left: Type and Date */}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontFamily: "Manrope-Bold",
                    fontSize: 14,
                    lineHeight: 20,
                    color: colors.titleText,
                    textTransform: "capitalize",
                  }}
                >
                  {activity.type}
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 10,
                    lineHeight: 14,
                    color: colors.mutedText,
                  }}
                >
                  {activity.date}
                </Text>
              </View>

              {/* Right: Amount and Value */}
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text
                  style={{
                    fontFamily: "Manrope-Bold",
                    fontSize: 14,
                    lineHeight: 20,
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
                    fontSize: 10,
                    lineHeight: 14,
                    color: colors.mutedText,
                    textAlign: "right",
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


