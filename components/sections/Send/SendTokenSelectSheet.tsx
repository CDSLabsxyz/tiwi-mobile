/**
 * Send Token Select Sheet
 * Bottom sheet for selecting token to send
 * Shows user's real wallet tokens
 */

import { SelectionBottomSheet } from "@/components/sections/Swap/SelectionBottomSheet";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import { TokenPrice } from "@/components/ui/TokenPrice";
import { colors } from "@/constants/colors";
import { useChains } from "@/hooks/useChains";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { formatTokenQuantity, getColorFromSeed } from "@/utils/formatting";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

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
  const [searchQuery, setSearchQuery] = useState("");
  const { data: balanceData, isLoading: isLoadingBalances } = useWalletBalances();
  const { data: chains, isLoading: isLoadingChains } = useChains();

  const isLoading = isLoadingBalances || isLoadingChains;

  const tokensWithChains = useMemo(() => {
    if (!balanceData) return [];

    return balanceData.tokens.map(token => ({
      token: {
        id: `${token.chainId}-${token.address}`,
        symbol: token.symbol,
        name: token.name,
        icon: token.logoURI,
        tvl: "0", // Not used in this list
        balanceFiat: `$${parseFloat(token.usdValue || '0').toFixed(2)}`,
        balanceToken: token.balanceFormatted || "0",
        address: token.address,
        chainId: token.chainId,
        decimals: token.decimals,
        priceUSD: token.priceUSD,
      } as TokenOption,
      chainId: token.chainId,
    }));
  }, [balanceData]);

  const filteredTokens = useMemo(() => {
    return tokensWithChains.filter(
      (item) =>
        item.token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.token.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tokensWithChains, searchQuery]);

  const handleSelect = (item: { token: TokenOption; chainId: number }) => {
    onSelect(item.token, item.chainId.toString());
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
          paddingHorizontal: 16,
          gap: 10,
          marginBottom: 21,
          marginHorizontal: 4,
          borderWidth: 1,
          borderColor: colors.bgStroke,
        }}
      >
        <Ionicons name="search" size={18} color="rgba(255, 255, 255, 0.5)" />
        <TextInput
          placeholder="Search Assets"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            flex: 1,
            fontFamily: "Manrope-Medium",
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
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: colors.bodyText }}>Loading assets...</Text>
          </View>
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
            const chain = chains?.find(c => c.id === chainId);
            const chainLogo = chain?.logoURI || chain?.logo;

            return (
              <TouchableOpacity
                key={token.id}
                activeOpacity={0.7}
                onPress={() => handleSelect(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                }}
              >
                {/* Left: Token Info */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  {/* Icon with Badge */}
                  <View style={{ width: 48, height: 48, position: "relative" }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: colors.bgStroke,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {token.icon ? (
                        <Image
                          source={{ uri: token.icon }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: getColorFromSeed(token.symbol),
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Text style={{ fontFamily: 'Manrope-Bold', fontSize: 16, color: '#FFF' }}>
                            {token.symbol.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Chain Badge */}
                    <View
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: colors.bg,
                        borderWidth: 1.5,
                        borderColor: colors.bg,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Image
                        source={chainLogo || require('@/assets/home/chains/ethereum.svg')}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                      />
                    </View>
                  </View>

                  <View style={{ gap: 2 }}>
                    <Text
                      style={{
                        fontFamily: "Manrope-Bold",
                        fontSize: 16,
                        color: colors.titleText,
                      }}
                    >
                      {token.symbol}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope-Regular",
                        fontSize: 12,
                        color: colors.mutedText,
                      }}
                    >
                      {chain?.name || "Unknown Chain"}
                    </Text>
                  </View>
                </View>

                {/* Right: Balance */}
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: "Manrope-Bold",
                      fontSize: 16,
                      color: colors.titleText,
                    }}
                  >
                    {formatTokenQuantity(token.balanceToken)}
                  </Text>
                  <TokenPrice
                    amount={parseFloat(token.balanceFiat.replace(/[$,]/g, "")) || 0}
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 12,
                      color: colors.mutedText,
                    }}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SelectionBottomSheet>
  );
};


