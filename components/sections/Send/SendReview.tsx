/**
 * Send Review Component
 * Review screen before confirming transaction
 * Matches Figma design (node-id: 3279-119877)
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/constants";
import { useSendStore } from "@/store/sendStore";
import { truncateAddress } from "@/utils/wallet";
import { WALLET_ADDRESS } from "@/utils/wallet";

const AlertIcon = require("@/assets/wallet/alert-square.svg");

interface SendReviewProps {
  onConfirm: () => void;
}

export const SendReview: React.FC<SendReviewProps> = ({ onConfirm }) => {
  const { selectedToken, selectedChain, recipientAddress, amount, usdValue, networkFee, networkFeeUSD } = useSendStore();

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
            {amount} {selectedToken?.symbol || ""}
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 12,
              color: colors.bodyText,
              textAlign: "center",
            }}
          >
            {usdValue}
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
        {/* From */}
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
            From
          </Text>
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              color: colors.bodyText,
            }}
          >
            {truncateAddress(WALLET_ADDRESS)}
          </Text>
        </View>

        {/* To and Network */}
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
              To
            </Text>
            <Text
              style={{
                fontFamily: "Manrope-Medium",
                fontSize: 14,
                color: colors.bodyText,
              }}
            >
              {truncateAddress(recipientAddress)}
            </Text>
          </View>
          <View
            style={{
              // flex:1,
              flexDirection: "column",
              // justifyContent: "flex-end",
              // alignItems: "flex-end",              
              // marginLeft: 'auto',
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
              Networkkkkkkkkkkkkkkkkkk
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

      {/* Network Fee */}
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
            Network Fee
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

      {/* Confirm Button - Consistent positioning with white space below */}
      {/* <View
        style={{
          marginTop: 48,
          marginBottom: 32,
          width: "100%",
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onConfirm}
          style={{
            width: "100%",
            height: 54,
            backgroundColor: colors.primaryCTA,
            borderRadius: 100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Manrope-Medium",
              fontSize: 16,
              color: colors.bg,
            }}
          >
            Confirm
          </Text>
        </TouchableOpacity>
      </View> */}
    </View>
  );
};


