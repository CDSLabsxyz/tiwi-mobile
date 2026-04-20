/**
 * Asset Detail Activities Component
 * Displays recent activities/transactions for the asset
 * Matches Figma design exactly (node-id: 3279-120307)
 */

import { TokenPrice } from "@/components/ui/TokenPrice";
import { colors } from "@/constants/colors";
import type { AssetActivity } from "@/services/walletService";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface AssetDetailActivitiesProps {
  activities: AssetActivity[];
  onViewAllPress?: () => void;
  onReceiptPress?: (activityId: string) => void;
}

/**
 * Asset Detail Activities - List of recent activities
 */
export const AssetDetailActivities: React.FC<AssetDetailActivitiesProps> = ({
  activities,
  onViewAllPress,
  onReceiptPress,
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
          const isSent = activity.type === "sent";
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
              <View style={{ gap: 2 }}>
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

              {/* Middle: Receipt link on Sent rows */}
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                {isSent && onReceiptPress && (
                  <TouchableOpacity
                    onPress={() => onReceiptPress(activity.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 11,
                      color: colors.primaryCTA,
                      textDecorationLine: "underline",
                    }}>
                      Receipt
                    </Text>
                  </TouchableOpacity>
                )}
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
                <TokenPrice
                  amount={activity.usdAmount || activity.usdValue}
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 10,
                    lineHeight: 14,
                    color: colors.mutedText,
                    textAlign: "right",
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};


