import React from "react";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/theme";

interface SwapLoadingOverlayProps {
  visible: boolean;
}

/**
 * Loading overlay for swap confirmation
 * Matches Figma loading state (node-id: 3279-117315)
 */
export const SwapLoadingOverlay: React.FC<SwapLoadingOverlayProps> = ({
  visible,
}) => {
  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(1, 5, 1, 0.7)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <ActivityIndicator size="large" color={colors.primaryCTA} />
    </View>
  );
};

