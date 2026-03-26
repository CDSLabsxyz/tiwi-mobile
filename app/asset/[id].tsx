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
import { useWalletStore } from "@/store/walletStore";
import { mapAssetToChainOption, mapAssetToTokenOption } from "@/utils/assetMapping";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AssetDetailScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { address: WALLET_ADDRESS } = useWalletStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{
    id: string;
    symbol?: string;
    name?: string;
    balance?: string;
    usdValue?: string;
    chainId?: string;
    logo?: string;
    priceUSD?: string;
    change24h?: string;
    address?: string;
    decimals?: string;
    tab?: string;
  }>();

  const { id, tab } = params;

  // Initialize Asset State from Params for instant UI
  const [asset, setAsset] = useState<AssetDetailType | null>(() => {
    if (!id || !params.symbol) return null;
    const change24hVal = parseFloat(params.change24h || "0");
    const isPositive = change24hVal >= 0;

    return {
      id,
      symbol: params.symbol || "",
      name: params.name || "",
      balance: params.balance || "0",
      usdValue: params.usdValue || "0",
      chainId: (params.chainId as any) || "ethereum",
      logo: params.logo || "",
      priceUSD: params.priceUSD || "0",
      change24h: change24hVal / 100,
      change24hAmount: isPositive ? `+${change24hVal.toFixed(2)}%` : `${change24hVal.toFixed(2)}%`,
      address: params.address || "0x0000000000000000000000000000000000000000",
      decimals: params.decimals ? Number(params.decimals) : 18,
      activities: [],
      chartData: { "1D": [], "1W": [], "1M": [], "1Y": [], "5Y": [], "All": [] },
    } as AssetDetailType;
  });

  const [isLoading, setIsLoading] = useState(!asset); // Only loading if we don't have param data
  const [timePeriod, setTimePeriod] = useState<ChartTimePeriod>("1D");

  // Stores
  const swapStore = useSwapStore();
  const assetStore = useAssetStore();

  // Fetch asset detail for full data (activities, chart)
  useEffect(() => {
    const loadAssetDetail = async () => {
      if (!id) return;

      // If we don't have initial asset data, show loading
      if (!asset) setIsLoading(true);

      try {
        const data = await fetchAssetDetail(id);

        setAsset(prev => {
          if (!prev) return data;

          // Trust the data passed from the list (prev) for core metadata 
          // and only enhance it with the fetched activities and chart data.
          // This prevents the "flicker" where it replaces real data with hardcoded mocks.
          return {
            ...prev,
            activities: data.activities && data.activities.length > 0 ? data.activities : prev.activities,
            chartData: data.chartData || prev.chartData
          };
        });

        // Store the merged or new asset in the store
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
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback if no history (e.g. direct link)
      const tabParam = tab ? `?tab=${tab}` : "";
      router.push(`/wallet${tabParam}` as any);
    }
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

    // Navigate to send screen with full asset details
    router.push({
      pathname: "/send",
      params: {
        assetId: id,
        symbol: asset.symbol,
        name: asset.name,
        balance: asset.balance,
        usdValue: asset.usdValue,
        chainId: asset.chainId,
        logo: typeof asset.logo === "string" ? asset.logo : undefined,
        priceUSD: asset.priceUSD,
        address: asset.address,
        decimals: asset.decimals.toString(),
      },
    } as any);
  };

  const handleReceivePress = () => {
    if (!asset) return;

    router.push({
      pathname: "/receive",
      params: {
        symbol: asset.symbol,
        name: asset.name,
        logoURI: typeof asset.logo === "string" ? asset.logo : undefined,
        chainId: asset.chainId,
        address: asset.address,
        isAutoSelected: "true"
      },
    } as any);
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

    // Navigate to swap screen with full asset details
    router.push({
      pathname: "/swap",
      params: {
        assetId: id,
        symbol: asset.symbol,
        name: asset.name,
        balance: asset.balance,
        usdValue: asset.usdValue,
        chainId: asset.chainId,
        logo: typeof asset.logo === "string" ? asset.logo : undefined,
        priceUSD: asset.priceUSD,
      },
    } as any);
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
          walletAddress={WALLET_ADDRESS!}
          onIrisScanPress={handleIrisScanPress}
          onSettingsPress={handleSettingsPress}
          showBackButton
          onBackPress={handleBackPress}
          showIrisScan={false}
          showSettings={true}
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
            width: "100%",
            paddingHorizontal: 12,
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

