/**
 * Asset Quick Actions Component
 * Four action buttons: Send, Receive, Swap, Activities
 * For asset detail screen - Swap instead of Pay
 */

import { colors } from "@/constants/colors";
import { Image } from "expo-image";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const SendIcon = require("@/assets/wallet/navigation-03.svg");
const ReceiveIcon = require("@/assets/wallet/download-04.svg");
const SwapIcon = require("@/assets/wallet/exchange-01.svg");
const ActivitiesIcon = require("@/assets/wallet/transaction-history.svg");

interface AssetQuickActionsProps {
  onSendPress?: () => void;
  onReceivePress?: () => void;
  onSwapPress?: () => void;
  onActivitiesPress?: () => void;
}

/**
 * Asset Quick Actions - Four action buttons with Swap instead of Pay
 */
export const AssetQuickActions: React.FC<AssetQuickActionsProps> = ({
  onSendPress,
  onReceivePress,
  onSwapPress,
  onActivitiesPress,
}) => {
  const actions = [
    {
      icon: SendIcon,
      label: "Send",
      onPress: onSendPress,
    },
    {
      icon: ReceiveIcon,
      label: "Receive",
      onPress: onReceivePress,
    },
    {
      icon: SwapIcon,
      label: "Swap",
      onPress: onSwapPress,
    },
    {
      icon: ActivitiesIcon,
      label: "Activities",
      onPress: onActivitiesPress,
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
          // activeOpacity={0.8}
          onPress={action.onPress}
          style={{
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
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
                style={{ width: '100%', height: '100%' }}
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


