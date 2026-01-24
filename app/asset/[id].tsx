/**
 * Asset Detail Screen
 * Displays full details of a single asset
 * Matches Figma design exactly (node-id: 3279-120250)
 */

import {
  AssetDetailActivities,
  AssetDetailHeader,
  PriceChart,
} from "@/components/sections/Wallet";
import { AssetQuickActions } from "@/components/sections/Wallet/AssetQuickActions";
import { WalletHeader } from "@/components/sections/Wallet/WalletHeader";
import { CustomStatusBar } from "@/components/ui/custom-status-bar";
import { colors } from "@/constants/colors";
import {
  fetchAssetDetail,
  type AssetDetail as AssetDetailType,
  type ChartTimePeriod,
} from "@/services/walletService";
import { useAssetStore } from "@/store/assetStore";
import { useSendStore } from "@/store/sendStore";
import { useSwapStore } from "@/store/swapStore";
import { mapAssetToChainOption, mapAssetToTokenOption } from "@/utils/assetMapping";
import { WALLET_ADDRESS } from "@/utils/wallet";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AssetDetailScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();

  // State
  const [asset, setAsset] = useState<AssetDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<ChartTimePeriod>("1D");

  // Stores
  const swapStore = useSwapStore();
  const assetStore = useAssetStore();

  // Fetch asset detail
  useEffect(() => {
    const loadAssetDetail = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        const data = await fetchAssetDetail(id);
        setAsset(data);
        // Store the current asset in the store for swap pre-population
        assetStore.setCurrentAsset(data);
      } catch (error) {
        console.error("Failed to fetch asset detail:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssetDetail();
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
    const currentRoute = pathname || `/asset/${id}`;
    const tabParam = tab ? `?tab=${tab}` : "";
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute + tabParam)}` as any);
  };

  const handleSendPress = () => {
    if (!asset) return;

    // Map asset to token and chain options
    const tokenOption = mapAssetToTokenOption(asset, asset.balance, asset.usdValue);
    const chainOption = mapAssetToChainOption(asset);

    if (tokenOption && chainOption) {
      // Pre-populate send store with asset details
      const sendStore = useSendStore.getState();
      sendStore.prePopulateFromAsset(tokenOption, chainOption, asset.balance, asset.usdValue);
    }

    // Navigate to send screen with asset ID
    router.push(`/send?assetId=${id}` as any);
  };

  const handleReceivePress = () => {
    router.push("/receive" as any);
  };

  const handleSwapPress = () => {
    if (!asset) return;

    // Map asset to token and chain options
    const tokenOption = mapAssetToTokenOption(asset, asset.balance, asset.usdValue);
    const chainOption = mapAssetToChainOption(asset);

    if (tokenOption && chainOption) {
      // Pre-populate swap store with asset details
      swapStore.setFromChain(chainOption);
      swapStore.setFromToken(tokenOption);
      // Clear toToken and toChain to let user select
      swapStore.setToToken(null);
      swapStore.setToChain(null);
      swapStore.setFromAmount("");
      swapStore.setToAmount("");
      swapStore.setSwapQuote(null);
    }

    // Navigate to swap screen
    router.push("/swap" as any);
  };

  const handleActivitiesPress = () => {
    // Navigate to activities page for this asset (same as View All)
    const tabParam = tab ? `?tab=${tab}` : "";
    router.push(`/asset/${id}/activities${tabParam}` as any);
  };

  const handleViewAllPress = () => {
    // Navigate to activities page for this asset
    const tabParam = tab ? `?tab=${tab}` : "";
    router.push(`/asset/${id}/activities${tabParam}` as any);
  };

  if (isLoading || !asset) {
    // TODO: Add skeleton loading UI
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bg }]}>
        <CustomStatusBar />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }]}>
      <CustomStatusBar />

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
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: (bottom || 16) + 24,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Content Container */}
        <View
          style={{
            width: 358,
            maxWidth: "100%",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 18,
          }}
        >
          {/* Asset Header */}
          <AssetDetailHeader asset={asset} />

          {/* Chart Section */}
          <View
            style={{
              width: "100%",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
            }}
          >
            <PriceChart
              asset={asset}
              timePeriod={timePeriod}
              onTimePeriodChange={setTimePeriod}
            />
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
            <AssetQuickActions
              onSendPress={handleSendPress}
              onReceivePress={handleReceivePress}
              onSwapPress={handleSwapPress}
              onActivitiesPress={handleActivitiesPress}
            />
          </View>

          {/* Recent Activities */}
          <AssetDetailActivities
            activities={asset.activities}
            onViewAllPress={handleViewAllPress}
          />
        </View>
      </ScrollView>
    </View>
  );
}

