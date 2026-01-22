import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "@/theme";

export type ExpiresOption = "never" | "24hours" | "7days" | "custom";

interface ExpiresSectionProps {
  selectedOption: ExpiresOption;
  onSelect: (option: ExpiresOption) => void;
}

/**
 * Expires section for Limit tab
 * Exact 1:1 match with Figma design (node-id: 3279-123860)
 * Height: 72px, matches Figma specs
 */
export const ExpiresSection: React.FC<ExpiresSectionProps> = ({
  selectedOption,
  onSelect,
}) => {
  const options: { key: ExpiresOption; label: string }[] = [
    { key: "never", label: "Never" },
    { key: "24hours", label: "24 Hours" },
    { key: "7days", label: "7 Days" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <View
      style={{
        width: 353,
        height: 72,
        borderRadius: 10.23,
        backgroundColor: colors.bgSemi,
        overflow: "hidden",
      }}
    >
      {/* Label */}
      <Text
        style={{
          position: "absolute",
          left: 12,
          top: 12.78,
          fontFamily: "Manrope-SemiBold",
          fontSize: 10,
          color: colors.bodyText,
          lineHeight: 10,
        }}
      >
        Expires
      </Text>

      {/* Options row */}
      <View
        style={{
          position: "absolute",
          left: 12,
          top: 38,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        {options.map((option) => {
          const isSelected = selectedOption === option.key;

          return (
            <TouchableOpacity
              key={option.key}
              activeOpacity={0.8}
              onPress={() => onSelect(option.key)}
              style={{
                width: 78,
                height: 24,
                borderRadius: 16,
                backgroundColor: isSelected
                  ? "#081f02" // Active: darker green background
                  : colors.bgCards, // Inactive: bgCards
                borderWidth: isSelected ? 0 : 0.5,
                borderColor: isSelected ? "transparent" : colors.bgStroke,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 16,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-SemiBold",
                  fontSize: 10,
                  color: isSelected
                    ? colors.primaryCTA // Active: green text
                    : colors.bodyText, // Inactive: body text
                  lineHeight: 10,
                  textAlign: "left",
                }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

