/**
 * Quick Actions Component
 * Four action buttons: Send, Receive, Pay, Activities
 * Matches Figma design exactly (node-id: 3279-118696)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const SendIcon = require("@/assets/home/navigation-03.svg");
const ReceiveIcon = require("@/assets/home/download-04.svg");
const PayIcon = require("@/assets/home/more/payment-02.svg");
const ActivitiesIcon = require("@/assets/home/transaction-history.svg");

interface QuickActionsProps {
  onSendPress?: () => void;
  onReceivePress?: () => void;
  onPayPress?: () => void;
  onActivitiesPress?: () => void;
}

/**
 * Quick Actions - Four action buttons in a row
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  onSendPress,
  onReceivePress,
  onPayPress,
  onActivitiesPress,
}) => {
  const actions = [
    {
      icon: SendIcon,
      label: "Send",
      onPress: onSendPress,
      width: 50,
    },
    {
      icon: ReceiveIcon,
      label: "Receive",
      onPress: onReceivePress,
      width: 56.5,
    },
    {
      icon: PayIcon,
      label: "Pay",
      onPress: onPayPress,
      width: 50,
    },
    {
      icon: ActivitiesIcon,
      label: "Activities",
      onPress: onActivitiesPress,
      width: 60.5,
    },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        width: "100%",
        paddingVertical: 0,
      }}
    >
      {actions.map((action, index) => (
        <TouchableOpacity
          key={index}
          activeOpacity={0.8}
          onPress={action.onPress}
          style={{
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: action.width,
          }}
        >
          {/* Icon Container */}
          <View
            style={{
              backgroundColor: colors.bgCards,
              padding: 8,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
              }}
            >
              <Image
                source={action.icon}
                className="w-full h-full"
                contentFit="contain"
              />
            </View>
          </View>

          {/* Label */}
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              color: colors.titleText,
              textAlign: "center",
            }}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

