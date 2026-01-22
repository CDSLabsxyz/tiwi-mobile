/**
 * Receive Screen
 * Displays token list with search, then QR code view for selected token
 * Matches Figma designs exactly (node-id: 3279-119208, 3279-119753)
 */

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import { Image } from "@/tw";
import { colors } from "@/theme";
import { StatusBar } from "@/components/ui/StatusBar";
import { WalletHeader } from "@/components/sections/Wallet/WalletHeader";
import { BottomNav } from "@/components/ui/BottomNav";
import { WALLET_ADDRESS, truncateAddress } from "@/utils/wallet";
import { fetchWalletData, type PortfolioItem } from "@/services/walletService";
import { mapAssetToTokenOption } from "@/utils/assetMapping";
import { getChainOptionWithFallback } from "@/utils/chainUtils";

const CopyIcon = require("@/assets/wallet/copy-01.svg");
const CheckmarkIcon = require("@/assets/swap/checkmark-circle-01.svg");
const SearchIcon = require("@/assets/swap/search-01.svg");
const IrisScanIcon = require("@/assets/home/iris-scan.svg");
const SettingsIcon = require("@/assets/home/settings-03.svg");

// Share icon - using a simple icon, can be replaced with actual share icon
const ShareIcon = require("@/assets/wallet/share-08.svg");

interface TokenWithAddress {
  token: ReturnType<typeof mapAssetToTokenOption>;
  address: string;
  chainId: string;
  asset: PortfolioItem;
}

export default function ReceiveScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tokenId?: string }>();
  
  const [tokens, setTokens] = useState<TokenWithAddress[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenWithAddress | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load tokens on mount
  useEffect(() => {
    loadTokens();
  }, []);

  // Handle token selection from URL params
  useEffect(() => {
    if (params.tokenId && tokens.length > 0) {
      const token = tokens.find(t => t.asset.id === params.tokenId);
      if (token) {
        setSelectedToken(token);
      }
    }
  }, [params.tokenId, tokens]);

  const loadTokens = async () => {
    setIsLoading(true);
    try {
      const walletData = await fetchWalletData(WALLET_ADDRESS);
      const tokensData: TokenWithAddress[] = walletData.portfolio.map((asset) => {
        const token = mapAssetToTokenOption(asset, asset.balance, asset.usdValue);
        // For now, use main wallet address. In production, this would be chain-specific
        // Solana addresses would be different from EVM addresses
        let address = WALLET_ADDRESS;
        if (asset.chainId === "aegis") {
          // Solana-like address format (mock)
          address = "Re9d3o52i092j9g9iu2ngmu0939i4ti938hT432";
        }
        return {
          token: token!,
          address,
          chainId: asset.chainId,
          asset,
        };
      });
      setTokens(tokensData);
    } catch (error) {
      console.error("Failed to load tokens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter tokens based on search
  const filteredTokens = tokens.filter(
    (item) =>
      item.token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle token selection - show QR code view
  const handleTokenSelect = (token: TokenWithAddress) => {
    setSelectedToken(token);
  };

  // Handle copy with visual feedback
  const handleCopy = async () => {
    if (!selectedToken) return;
    try {
      await Clipboard.setStringAsync(selectedToken.address);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
      Alert.alert("Error", "Failed to copy address");
    }
  };

  // Handle share functionality
  const handleShare = async () => {
    if (!selectedToken) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        // Format the share message with token info for better UX
        const shareMessage = `My ${selectedToken.token.symbol} (${selectedToken.token.name}) wallet address:\n\n${selectedToken.address}`;
        await Sharing.shareAsync(shareMessage);
      } else {
        // Fallback: Copy to clipboard if sharing is not available
        await Clipboard.setStringAsync(selectedToken.address);
        Alert.alert("Copied", "Wallet address copied to clipboard");
      }
    } catch (error: any) {
      // User might have cancelled the share dialog - that's okay
      if (error?.code !== "ERR_CANCELLED") {
        console.error("Failed to share address:", error);
        // Fallback: Copy to clipboard on error
        try {
          await Clipboard.setStringAsync(selectedToken.address);
          Alert.alert("Copied", "Wallet address copied to clipboard");
        } catch (clipboardError) {
          Alert.alert("Error", "Failed to share or copy address");
        }
      }
    }
  };

  // Handle back press
  const handleBackPress = () => {
    if (selectedToken) {
      setSelectedToken(null);
    } else {
      router.back();
    }
  };

  // Handle settings press
  const handleSettingsPress = () => {
    const currentRoute = pathname || "/receive";
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
  };

  // Handle iris scan press
  const handleIrisScanPress = () => {
    // TODO: Implement iris scan
    console.log("Iris scan pressed");
  };

  // Handle copy from token list
  const handleTokenCopy = async (token: TokenWithAddress) => {
    try {
      await Clipboard.setStringAsync(token.address);
      Alert.alert("Copied", "Address copied to clipboard");
    } catch (error) {
      console.error("Failed to copy address:", error);
      Alert.alert("Error", "Failed to copy address");
    }
  };

  // If token is selected, show QR code view
  if (selectedToken) {
    const chainOption = getChainOptionWithFallback(selectedToken.chainId as any);
    
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg }}>
        <StatusBar />

        {/* Sticky Header */}
        <View
          style={{
            paddingTop: top || 0,
            backgroundColor: colors.bg,
          }}
        >
          <WalletHeader
            walletAddress={WALLET_ADDRESS}
            onIrisScanPress={handleIrisScanPress}
            onSettingsPress={handleSettingsPress}
            showBackButton
            onBackPress={handleBackPress}
          />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: 24,
            paddingBottom: (bottom || 16) + 76 + 24, // Bottom nav + padding
            alignItems: "center",
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Content Container */}
          <View
            style={{
              width: 357,
              maxWidth: "100%",
              flexDirection: "column",
              alignItems: "center",
              gap: 85, // Gap between warning and QR section (matches design)
            }}
          >
            {/* Warning Banner */}
            <View
              style={{
                width: 329,
                backgroundColor: "#2b1f0d",
                borderRadius: 16,
                padding: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 12,
                  lineHeight: 20,
                  color: colors.titleText,
                  textAlign: "center",
                  width: 329,
                }}
              >
                <Text>Only send </Text>
                <Text style={{ fontFamily: "Manrope-Bold", fontWeight: "bold" }}>
                  {selectedToken.token.name} ({selectedToken.token.symbol})
                </Text>
                <Text> to this address. other assets will be lost forever.</Text>
              </Text>
            </View>

            {/* QR Code Section */}
            <View
              style={{
                width: 274,
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
              }}
            >
              {/* QR Code Container */}
              <View
                style={{
                  width: 274,
                  height: 274,
                  backgroundColor: colors.bodyText, // #B5B5B5
                  borderRadius: 16,
                  padding: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <QRCode
                  value={selectedToken.address}
                  size={288}
                  color="#000000" // Pure black for better contrast
                  backgroundColor={colors.bodyText} // #B5B5B5
                />
              </View>

              {/* Address Text - Wrapped */}
              <Text
                style={{
                  fontFamily: "Manrope-Medium",
                  fontSize: 16,
                  lineHeight: 20,
                  color: colors.bodyText,
                  textAlign: "center",
                  width: "100%",
                  maxWidth: 274,
                }}
              >
                {selectedToken.address}
              </Text>

              {/* Action Buttons */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 13,
                }}
              >
                {/* Copy Button */}
                <View
                  style={{
                    width: 100,
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleCopy}
                    style={{
                      width: "100%",
                      backgroundColor: colors.bgSemi,
                      borderRadius: 12,
                      padding: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {copied ? (
                      <Image
                        source={CheckmarkIcon}
                        style={{ width: 24, height: 24 }}
                        contentFit="contain"
                      />
                    ) : (
                      <Image
                        source={CopyIcon}
                        style={{ width: 24, height: 24 }}
                        contentFit="contain"
                      />
                    )}
                  </TouchableOpacity>
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 14,
                      color: colors.titleText,
                      textAlign: "center",
                    }}
                  >
                    Copy
                  </Text>
                </View>

                {/* Share Button */}
                <View
                  style={{
                    width: 100,
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleShare}
                    style={{
                      width: "100%",
                      backgroundColor: colors.bgSemi,
                      borderRadius: 12,
                      padding: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Image
                      source={ShareIcon}
                      style={{ width: 24, height: 24 }}
                      contentFit="contain"
                    />
                  </TouchableOpacity>
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 14,
                      color: colors.titleText,
                      textAlign: "center",
                    }}
                  >
                    Share
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNav />
      </View>
    );
  }

  // Token list view
  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Sticky Header */}
      <View
        style={{
          paddingTop: top || 0,
          backgroundColor: colors.bg,
        }}
      >
        <WalletHeader
          walletAddress={WALLET_ADDRESS}
          onIrisScanPress={handleIrisScanPress}
          onSettingsPress={handleSettingsPress}
          showBackButton
          onBackPress={handleBackPress}
        />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 76 + 24, // Bottom nav + padding
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content Container */}
        <View
          style={{
            width: 353,
            maxWidth: "100%",
            flexDirection: "column",
            alignItems: "center",
            gap: 21,
          }}
        >
          {/* Title */}
          <Text
            style={{
              fontFamily: "Manrope-SemiBold",
              fontSize: 20,
              lineHeight: 20,
              color: colors.titleText,
              textAlign: "center",
              textTransform: "capitalize",
            }}
          >
            Receive Asset
          </Text>

          {/* Search Bar */}
          <View
            style={{
              width: "100%",
              height: 48,
              backgroundColor: colors.bgSemi,
              borderRadius: 20,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 24,
              gap: 5,
            }}
          >
            <Image
              source={SearchIcon}
              style={{ width: 16, height: 16 }}
              contentFit="contain"
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search"
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              style={{
                flex: 1,
                fontFamily: "Manrope-Regular",
                fontSize: 14,
                color: colors.titleText,
                padding: 0,
                margin: 0,
              }}
            />
          </View>

          {/* Token List */}
          {isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text style={{ color: colors.bodyText }}>Loading tokens...</Text>
            </View>
          ) : (
            <View
              style={{
                width: "100%",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {filteredTokens.map((item, index) => {
                const chainOption = getChainOptionWithFallback(item.chainId as any);
                const truncatedAddr = truncateAddress(item.address);
                
                return (
                  <TouchableOpacity
                    key={item.asset.id}
                    activeOpacity={0.8}
                    onPress={() => handleTokenSelect(item)}
                    style={{
                      width: "100%",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      paddingHorizontal: 0,
                    }}
                  >
                    {/* Left: Token Info */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 9,
                        width: 203,
                      }}
                    >
                      {/* Token Icon with Chain Badge */}
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
                            borderRadius: 28.5,
                            backgroundColor: "#1f261e",
                            borderWidth: 1,
                            borderColor: "#7c7c7c",
                            overflow: "hidden",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {typeof item.token.icon === "object" && "uri" in item.token.icon ? (
                            <Image
                              source={{ uri: item.token.icon.uri }}
                              style={{ width: 56, height: 56 }}
                              contentFit="cover"
                            />
                          ) : (
                            <Image
                              source={item.token.icon}
                              style={{ width: 56, height: 56 }}
                              contentFit="cover"
                            />
                          )}
                        </View>
                        {/* Chain Badge */}
                        <View
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: "#1f261e",
                            borderWidth: 1,
                            borderColor: colors.bg,
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          <Image
                            source={chainOption.icon}
                            style={{ width: 47, height: 47 }}
                            contentFit="contain"
                          />
                        </View>
                      </View>

                      {/* Token Symbol and Address */}
                      <View
                        style={{
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 0,
                          width: 106,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-end",
                            gap: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope-SemiBold",
                              fontSize: 16,
                              color: colors.bodyText,
                            }}
                          >
                            {item.token.symbol}
                          </Text>
                          <View style={{ width: 24, height: 24 }} />
                        </View>
                        <Text
                          style={{
                            fontFamily: "Manrope-Medium",
                            fontSize: 14,
                            color: colors.bodyText,
                          }}
                        >
                          {truncatedAddr}
                        </Text>
                      </View>
                    </View>

                    {/* Right: Action Icons */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 9,
                      }}
                    >
                      {/* QR Code Icon - triggers token selection */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleTokenSelect(item)}
                        style={{
                          width: 30,
                          height: 30,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Image
                          source={IrisScanIcon}
                          style={{ width: 30, height: 30 }}
                          contentFit="contain"
                        />
                      </TouchableOpacity>

                      {/* Copy Icon */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleTokenCopy(item)}
                        style={{
                          width: 24,
                          height: 24,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Image
                          source={CopyIcon}
                          style={{ width: 24, height: 24 }}
                          contentFit="contain"
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
