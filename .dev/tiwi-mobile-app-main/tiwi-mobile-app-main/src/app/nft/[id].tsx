/**
 * NFT Detail Screen
 * Displays full details of a single NFT
 * Matches Figma design exactly (node-id: 3279-120155)
 */

import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "@/tw";
import { StatusBar } from "@/components/ui/StatusBar";
import { WalletHeader } from "@/components/sections/Wallet/WalletHeader";
import { QuickActions } from "@/components/sections/Wallet/QuickActions";
import {
  NFTDetailHeader,
  NFTDetailStats,
  NFTDetailActivities,
} from "@/components/sections/Wallet";
import { colors } from "@/theme";
import { WALLET_ADDRESS } from "@/utils/wallet";
import {
  fetchNFTDetail,
  type NFTDetail as NFTDetailType,
} from "@/services/walletService";

export default function NFTDetailScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();

  // State
  const [nft, setNft] = useState<NFTDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Fetch NFT detail
  useEffect(() => {
    const loadNFTDetail = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        const data = await fetchNFTDetail(id);
        setNft(data);
      } catch (error) {
        console.error("Failed to fetch NFT detail:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNFTDetail();
  }, [id]);

  // Handlers
  const handleBackPress = () => {
    // Navigate back to wallet screen with the preserved tab
    const tabParam = tab ? `?tab=${tab}` : "";
    router.push(`/wallet${tabParam}` as any);
  };

  const handleIrisScanPress = () => {
    // TODO: Implement iris scan functionality
    console.log("Iris scan pressed");
  };

  const handleSettingsPress = () => {
    const currentRoute = pathname || `/nft/${id}`;
    const tabParam = tab ? `?tab=${tab}` : "";
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute + tabParam)}` as any);
  };

  const handleSendPress = () => {
    // TODO: Navigate to send screen
    console.log("Send pressed");
  };

  const handleReceivePress = () => {
    // TODO: Navigate to receive screen
    console.log("Receive pressed");
  };

  const handleActivitiesPress = () => {
    router.push("/wallet" as any);
  };

  const handleFavoritePress = () => {
    setIsFavorite(!isFavorite);
  };

  if (isLoading || !nft) {
    // TODO: Add skeleton loading UI
    return (
      <View className="flex-1" style={{ backgroundColor: colors.bg }}>
        <StatusBar />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} />
      </View>
    );
  }

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
          paddingBottom: (bottom || 16) + 24,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* NFT Image */}
        <View
          style={{
            width: "100%",
            height: 196,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Image
            source={{ uri: nft.mediaUrl }}
            style={{
              width: "100%",
              height: "100%",
            }}
            contentFit="cover"
          />
          {/* Gradient Overlay */}
          <LinearGradient
            colors={["rgba(0,0,0,0.36)", "rgba(0,0,0,0.6)"]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        </View>

        {/* Content Container */}
        <View
          style={{
            width: 358,
            maxWidth: "100%",
            flexDirection: "column",
            alignItems: "center",
            gap: 25,
            marginTop: 3,
          }}
        >
          {/* NFT Header (Name, Creator, Favorite) */}
          <View
            style={{
              width: "100%",
              flexDirection: "column",
              gap: 26,
            }}
          >
            <NFTDetailHeader
              nft={nft}
              isFavorite={isFavorite}
              onFavoritePress={handleFavoritePress}
            />

            {/* NFT Stats */}
            <NFTDetailStats nft={nft} />
          </View>

          {/* Quick Actions */}
          <View
            style={{
              width: "100%",
              height: 95,
              backgroundColor: colors.bgSemi,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QuickActions
              onSendPress={handleSendPress}
              onReceivePress={handleReceivePress}
              onPayPress={() => {}}
              onActivitiesPress={handleActivitiesPress}
            />
          </View>

          {/* Recent Activities */}
          <NFTDetailActivities activities={nft.activities} />
        </View>
      </ScrollView>
    </View>
  );
}

