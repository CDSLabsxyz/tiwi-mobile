import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors } from "@/theme";
import type { SwapTabKey } from "./SwapTabs";

interface SwapConfirmButtonProps {
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  activeTab?: SwapTabKey;
  hasValidQuote?: boolean; // Only show specific labels when quote is valid
}

/**
 * Primary Confirm CTA for swap/limit
 * Matches Figma bottom button (node-id: 3279-117185, 3279-124496)
 * Shows "Place Limit Order" for limit tab, "Swap Token" for swap tab (only when valid quote)
 */
export const SwapConfirmButton: React.FC<SwapConfirmButtonProps> = ({
  label,
  disabled,
  loading,
  onPress,
  activeTab = "swap",
  hasValidQuote = false,
}) => {
  const isDisabled = disabled || loading;

  // Determine button label based on tab and quote validity
  const getButtonLabel = (): string => {
    // If custom label provided, use it
    if (label) return label;
    
    // Only show specific labels when there's a valid quote
    if (hasValidQuote) {
      if (activeTab === "limit") {
        return "Place Limit Order";
      } else {
        return "Swap Tokens";
      }
    }
    
    // Default label when no quote
    return "Confirm";
  };

  const displayLabel = getButtonLabel();

  return (
    <View
      style={{
        width: 353,
        alignSelf: "center",
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={isDisabled}
        style={{
          height: 56,
          borderRadius: 100,
          paddingHorizontal: 24,
          backgroundColor: colors.primaryCTA,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#050201" />
        ) : (
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              lineHeight: 16 * 1.6,
              color: "#050201",
              textAlign: "center",
            }}
          >
            {displayLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};


