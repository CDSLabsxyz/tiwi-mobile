/**
 * Multi-Send Review Component
 * Review screen before confirming multi-send transaction
 * Matches Figma design (node-id: 3279-119145)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/constants";
import { useSendStore } from "@/store/sendStore";

const AlertIcon = require("@/assets/wallet/alert-square.svg");

interface MultiSendReviewProps {
  onConfirm: () => void;
}

export const MultiSendReview: React.FC<MultiSendReviewProps> = ({ onConfirm }) => {
  const { selectedToken, selectedChain, amountPerRecipient, totalRecipients, networkFee, networkFeeUSD } = useSendStore();

  const totalAmount = parseFloat(amountPerRecipient || "0") * totalRecipients;
  const totalAmountUSD = totalAmount * 1000; // Mock price

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "column",
        gap: 12,
        paddingTop: 20,
      }}
    >
      {/* Amount Display */}
      <View
        style={{
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        <Text
          style={{
            fontFamily: "Manrope-SemiBold",
            fontSize: 20,
            lineHeight: 20,
            color: colors.titleText,
            textTransform: "capitalize",
          }}
        >
          Confirm
        </Text>
        <View
          style={{
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 36,
              color: colors.titleText,
            }}
          >
            {totalAmount.toFixed(3)} {selectedToken?.symbol || ""}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              color: colors.bodyText,
              textAlign: "center",
            }}
          >
            ${totalAmountUSD.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Transaction Details */}
      <View
        style={{
          backgroundColor: colors.bgSemi,
          borderRadius: 16,
          paddingHorizontal: 17,
          paddingVertical: 10,
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Total Recipients */}
        <View
          style={{
            flexDirection: "column",
            gap: 3,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              color: colors.bodyText,
            }}
          >
            Total Recipients:
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              color: colors.bodyText,
            }}
          >
            {totalRecipients}
          </Text>
        </View>

        {/* Amount per Recipient and Network */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "column",
              gap: 3,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-Regular",
                fontSize: 12,
                color: colors.bodyText,
              }}
            >
              Amount per Recipient:
            </Text>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              {amountPerRecipient} {selectedToken?.symbol || ""}
            </Text>
          </View>
          <View
            style={{
              // width: 56,
              flexDirection: "column",
              gap: 3,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope-Regular",
                fontSize: 12,
                color: colors.bodyText,
              }}
            >
              Network
            </Text>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 16,
                color: colors.bodyText,
              }}
            >
              {selectedChain?.name || "N/A"}
            </Text>
          </View>
        </View>
      </View>

      {/* Estimated Gas Fee */}
      <View
        style={{
          backgroundColor: colors.bgSemi,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 11,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              color: colors.bodyText,
            }}
          >
            Estimated Gas (Batch Send)
          </Text>
          <View
            style={{
              width: 18,
              height: 18,
            }}
          >
            <Image
              source={AlertIcon}
              className="w-full h-full"
              contentFit="contain"
            />
          </View>
        </View>
        <View
          style={{
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 14,
              color: colors.bodyText,
            }}
          >
            {networkFeeUSD}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              color: colors.bodyText,
              textAlign: "right",
            }}
          >
            {networkFeeUSD}
          </Text>
        </View>
      </View>

    </View>
  );
};


