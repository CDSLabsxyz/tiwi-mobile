import React from "react";
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { Image } from "@/tw";
import { colors } from "@/theme";
import { SelectionBottomSheet } from "./SelectionBottomSheet";

const EthereumIcon = require("@/assets/home/chains/ethereum.svg");
const ApexIcon = require("@/assets/home/chains/near.svg");
const VerdantIcon = require("@/assets/home/chains/polygon.svg");
const AegisIcon = require("@/assets/home/chains/solana.svg");
const CortexIcon = require("@/assets/home/chains/avalanche.svg");
const CheckmarkIcon = require("@/assets/swap/checkmark-circle-01.svg");

export type ChainId =
  | "ethereum"
  | "apex"
  | "verdant"
  | "aegis"
  | "cortex";

export interface ChainOption {
  id: ChainId;
  name: string;
  icon: any;
}

const CHAIN_OPTIONS: ChainOption[] = [
  { id: "ethereum", name: "Ethereum", icon: EthereumIcon },
  { id: "apex", name: "Apex Network", icon: ApexIcon },
  { id: "verdant", name: "Verdant Protocol", icon: VerdantIcon },
  { id: "aegis", name: "Aegis Core", icon: AegisIcon },
  { id: "cortex", name: "Cortex Chain", icon: CortexIcon },
];

interface ChainSelectSheetProps {
  visible: boolean;
  selectedChainId: ChainId;
  onSelect: (option: ChainOption) => void;
  onClose: () => void;
}

/**
 * Chain selection bottom sheet
 * Matches Figma chain dropdown menu (node-ids: 3279-117965, 3279-118339)
 */
export const ChainSelectSheet: React.FC<ChainSelectSheetProps> = ({
  visible,
  selectedChainId,
  onSelect,
  onClose,
}) => {
  const handleSelect = (option: ChainOption) => {
    onSelect(option);
  };

  return (
    <SelectionBottomSheet
      visible={visible}
      title="Chain Selection"
      onClose={onClose}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 24,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {CHAIN_OPTIONS.map((option) => {
          // Only show active state if a chain is actually selected (not null)
          const isActive = selectedChainId !== null && option.id === selectedChainId;

          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.9}
              onPress={() => handleSelect(option)}
              style={{
                height: 56,
                borderRadius: 16,
                backgroundColor: isActive ? colors.bgShade20 : colors.bgSemi,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 24,
                  height: "100%",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                    }}
                  >
                    <Image
                      source={option.icon}
                      className="w-full h-full"
                      contentFit="contain"
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 14,
                      color: colors.titleText,
                    }}
                  >
                    {option.name}
                  </Text>
                </View>

                {isActive && (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                    }}
                  >
                    <Image
                      source={CheckmarkIcon}
                      className="w-full h-full"
                      contentFit="contain"
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SelectionBottomSheet>
  );
};


