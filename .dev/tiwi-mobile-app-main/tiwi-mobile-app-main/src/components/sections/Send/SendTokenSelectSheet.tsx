/**
 * Send Token Select Sheet
 * Bottom sheet for selecting token to send
 * Shows user's wallet tokens
 */

import React, { useState, useEffect } from "react";
import { ScrollView, View, Text, TouchableOpacity, TextInput } from "react-native";
import { SelectionBottomSheet } from "@/components/sections/Swap/SelectionBottomSheet";
import { Image } from "@/tw";
import { colors } from "@/theme";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import { fetchWalletData } from "@/services/walletService";
import { WALLET_ADDRESS } from "@/utils/wallet";
import { mapAssetToTokenOption, mapAssetToChainOption } from "@/utils/assetMapping";
import { TokenListSkeleton } from "@/components/ui/SkeletonLoader";
import { getChainOptionWithFallback } from "@/utils/chainUtils";

const SearchIcon = require("@/assets/swap/search-01.svg");
const CheckmarkIcon = require("@/assets/swap/checkmark-circle-01.svg");

interface SendTokenSelectSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (token: TokenOption, chainId?: string) => void;
}

export const SendTokenSelectSheet: React.FC<SendTokenSelectSheetProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const [tokens, setTokens] = useState<TokenOption[]>([]);
  const [tokensWithChains, setTokensWithChains] = useState<Array<{ token: TokenOption; chainId?: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadTokens();
    }
  }, [visible]);

  const loadTokens = async () => {
    setIsLoading(true);
    try {
      const walletData = await fetchWalletData(WALLET_ADDRESS);
      const tokensData = walletData.portfolio.map((asset) => {
        const token = mapAssetToTokenOption(asset, asset.balance, asset.usdValue);
        return { token, chainId: asset.chainId };
      });
      setTokens(tokensData.map((t) => t.token));
      setTokensWithChains(tokensData);
    } catch (error) {
      console.error("Failed to load tokens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTokens = tokensWithChains.filter(
    (item) =>
      item.token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (item: { token: TokenOption; chainId?: string }) => {
    onSelect(item.token, item.chainId);
    setSearchQuery("");
  };

  return (
    <SelectionBottomSheet
      visible={visible}
      title="Select Asset"
      onClose={onClose}
    >
      {/* Search Bar */}
      <View
        style={{
          height: 48,
          backgroundColor: colors.bgCards,
          borderRadius: 20,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          gap: 5,
          marginBottom: 21,
        }}
      >
        <View
          style={{
            width: 16,
            height: 16,
          }}
        >
          <Image
            source={SearchIcon}
            className="w-full h-full"
            contentFit="contain"
          />
        </View>
        <TextInput
          placeholder="Search Assets"
          placeholderTextColor="rgba(255, 255, 255, 0.7)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            flex: 1,
            fontFamily: "Manrope-Regular",
            fontSize: 14,
            color: colors.titleText,
          }}
        />
      </View>

      {/* Token List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <TokenListSkeleton />
        ) : filteredTokens.length === 0 ? (
          <Text
            style={{
              fontFamily: "Manrope-Regular",
              fontSize: 14,
              color: colors.bodyText,
              textAlign: "center",
              paddingVertical: 20,
            }}
          >
            No tokens found
          </Text>
        ) : (
          filteredTokens.map((item) => {
            const { token, chainId } = item;
            const chain = chainId ? getChainOptionWithFallback(chainId) : null;
            
            return (
              <TouchableOpacity
                key={token.id}
                activeOpacity={0.8}
                onPress={() => handleSelect(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 82,
                  paddingVertical: 12,
                }}
              >
                {/* Left: Token Info */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  <View
                    style={{
                      width: 57,
                      height: 57,
                      position: "relative",
                    }}
                  >
                    <View
                      style={{
                        width: 57,
                        height: 57,
                        borderRadius: 57 / 2,
                        backgroundColor: colors.bgStroke,
                        borderWidth: 1,
                        borderColor: colors.bodyText,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Image
                        source={token.icon}
                        className="w-full h-full"
                        contentFit="cover"
                      />
                    </View>
                    {/* Chain Badge */}
                    {chain && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: colors.bgStroke,
                          borderWidth: 1,
                          borderColor: colors.bodyText,
                          overflow: "hidden",
                        }}
                      >
                        <Image
                          source={chain.icon}
                          className="w-full h-full"
                          contentFit="cover"
                        />
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope-SemiBold",
                        fontSize: 16,
                        color: colors.bodyText,
                      }}
                    >
                      {token.symbol}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope-Regular",
                        fontSize: 12,
                        color: colors.bodyText,
                      }}
                    >
                      {chain?.name || token.name}
                    </Text>
                  </View>
                </View>

                {/* Right: Balance */}
                <View
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 0,
                    width: 75,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 18,
                      color: colors.bodyText,
                    }}
                  >
                    {token.balanceToken.split(" ")[0]}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 12,
                      color: colors.bodyText,
                    }}
                  >
                    {token.balanceFiat}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SelectionBottomSheet>
  );
};


