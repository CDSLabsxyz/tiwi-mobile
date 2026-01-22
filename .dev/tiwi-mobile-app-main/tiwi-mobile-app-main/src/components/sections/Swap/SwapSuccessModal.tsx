import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "@/tw";
import { colors } from "@/theme";
import type { SwapTabKey } from "./SwapTabs";

const CheckmarkIcon = require("@/assets/swap/checkmark-circle-01.svg");

interface SwapSuccessModalProps {
  visible: boolean;
  onDone: () => void;
  activeTab?: SwapTabKey; // To differentiate between swap and limit success messages
}

/**
 * Success modal after swap/limit completion
 * Matches Figma success state (node-id: 3279-117769, 3279-125160)
 * Shows "Limit Set Successfully!" for limit orders, "Swap Successfull!" for swaps
 */
export const SwapSuccessModal: React.FC<SwapSuccessModalProps> = ({
  visible,
  onDone,
  activeTab = "swap",
}) => {
  const isLimitOrder = activeTab === "limit";
  
  // Match Figma exactly: "Limit Set  Successfully!" (with double space)
  const title = isLimitOrder ? "Limit Set  Successfully!" : "Swap Successfull!";
  const description = isLimitOrder
    ? "Your transaction limit has been updated and applied."
    : "The transaction was confirmed and the funds are now in your wallet.";
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDone}
      statusBarTranslucent
    >
      {/* Blurred backdrop - matches Figma design exactly (backdrop-blur-md) */}
      <View
        style={{
          flex: 1,
        }}
      >
        <BlurView
          intensity={50}
          tint="dark"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        {/* Semi-transparent overlay on top of blur */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(1, 5, 1, 0.7)",
          }}
        />
        {/* Modal content on top */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: 353,
              backgroundColor: colors.bgSemi,
              borderRadius: 24,
              padding: 24,
              alignItems: "center",
              gap: 24,
            }}
          >
          {/* Success icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 80 / 2,
              backgroundColor: colors.primaryCTA,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.primaryCTA,
              shadowOffset: { width: 0, height: 2.581 },
              shadowOpacity: 0.2,
              shadowRadius: 7.742,
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
              }}
            >
              <Image
                source={CheckmarkIcon}
                className="w-full h-full"
                contentFit="contain"
              />
            </View>
          </View>

          {/* Title */}
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 14,
              color: colors.titleText,
              textAlign: "center",
              width: 180,
            }}
          >
            {title}
          </Text>

          {/* Description */}
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 12,
              color: colors.bodyText,
              textAlign: "center",
              width: 318,
            }}
          >
            {description}
          </Text>

          {/* Done button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onDone}
            style={{
              width: 313,
              height: 56,
              borderRadius: 100,
              backgroundColor: colors.primaryCTA,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 16,
                lineHeight: 16 * 1.6,
                color: "#050201",
                textAlign: "center",
              }}
            >
              Done
            </Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

