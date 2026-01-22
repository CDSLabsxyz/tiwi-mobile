import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";

const ArrowUp02 = require("@/assets/swap/arrow-up-02.svg");

interface SwapDirectionButtonProps {
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * Small direction toggle button between From/To cards
 * Exact 1:1 match with Figma (node-id: 3279-117179)
 * Position: ml-[165px] mt-[82px] from container
 * Size: padding 6.4px, border 1.6px, rounded 6.4px
 * Icon: 19.2px, flipped vertically (scale-y-[-100%])
 */
export const SwapDirectionButton: React.FC<SwapDirectionButtonProps> = ({
  onPress,
  disabled,
}) => {
  // Figma exact measurements:
  // - Position: left 165px, top 82px from parent container
  // - Container: padding 6.4px, border 1.6px #010501, rounded 6.4px
  // - Background: #1f261e
  // - Icon: 19.2px, vertically flipped
  
  const buttonSize = 19.2 + 6.4 * 2; // icon + padding on both sides = 32px total
  
  return (
    <View
      style={{
        position: "absolute",
        left: 165,
        top: 82,
        width: buttonSize,
        height: buttonSize,
        borderRadius: 6.4,
        backgroundColor: colors.bgStroke, // #1f261e
        borderWidth: 1.6,
        borderColor: colors.bg, // #010501
        padding: 6.4,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        disabled={disabled}
        activeOpacity={0.8}
        onPress={onPress}
        style={{
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Icon flipped vertically to point down */}
        <View
          style={{
            width: 19.2,
            height: 19.2,
          }}
        >
          <Image
            source={ArrowUp02}
            className="w-full h-full"
            contentFit="contain"
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};


