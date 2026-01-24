/**
 * NFT Detail Activities Component
 * Displays recent activities/transactions for the NFT
 * Matches Figma design exactly (node-id: 3279-120211)
 */

import React from "react";
import { View, Text } from "react-native";
import { colors } from "@/constants/colors";
import type { NFTActivity } from "@/services/walletService";

interface NFTDetailActivitiesProps {
  activities: NFTActivity[];
}

/**
 * NFT Detail Activities - List of recent activities
 */
export const NFTDetailActivities: React.FC<NFTDetailActivitiesProps> = ({
  activities,
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

      {/* Activities List */}
      <View
        style={{
          width: "100%",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {activities.map((activity) => (
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

            {/* Right: NFT Name and Amount */}
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
                  color: "#498F00",
                  textAlign: "right",
                }}
              >
                {activity.nftName}
              </Text>
              {activity.amount && (
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
                  {activity.amount}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};


