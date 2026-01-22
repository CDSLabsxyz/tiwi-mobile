/**
 * Wallet Screen
 * Main wallet screen displaying balance, quick actions, and asset portfolio
 * Matches Figma design exactly (node-id: 3279-118680)
 */

import React, { useState, useEffect, useMemo } from "react";
import { View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { StatusBar } from "@/components/ui/StatusBar";
import { BottomNav } from "@/components/ui/BottomNav";
import {
  WalletHeader,
  TotalBalanceCard,
  QuickActions,
  ClaimableRewardsCard,
  AssetsTabSwitcher,
  AssetListItem,
  NFTList,
  type WalletTabKey,
} from "@/components/sections/Wallet";
import { colors } from "@/theme";
import { WALLET_ADDRESS } from "@/utils/wallet";
import {
  fetchWalletData,
  fetchNFTs,
  type WalletData,
  type NFTItem,
} from "@/services/walletService";
import { useAssetStore } from "@/store/assetStore";
import { useFilterStore } from "@/store/filterStore";
import { FilterModal } from "@/components/sections/Wallet/FilterModal";
import { applyFilters } from "@/utils/assetFilters";

export default function WalletScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string }>();
  const assetStore = useAssetStore();
  
  // Subscribe to filter store values for reactivity
  const sortBy = useFilterStore((state) => state.sortBy);
  const tokenCategories = useFilterStore((state) => state.tokenCategories);
  const chains = useFilterStore((state) => state.chains);

  // State
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  
  // Initialize activeTab from URL params or default to "assets"
  const [activeTab, setActiveTab] = useState<WalletTabKey>(
    (params.tab === "nfts" ? "nfts" : "assets") as WalletTabKey
  );

  // Update activeTab when URL params change (e.g., when navigating back)
  useEffect(() => {
    if (params.tab === "nfts" || params.tab === "assets") {
      setActiveTab(params.tab as WalletTabKey);
    }
  }, [params.tab]);

  // Fetch wallet data
  useEffect(() => {
    const loadWalletData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchWalletData(WALLET_ADDRESS);
        setWalletData(data);
      } catch (error) {
        console.error("Failed to fetch wallet data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWalletData();
  }, []);

  // Fetch NFTs when NFT tab is active
  useEffect(() => {
    if (activeTab === "nfts" && nfts.length === 0) {
      const loadNFTs = async () => {
        setIsLoadingNFTs(true);
        try {
          const data = await fetchNFTs(WALLET_ADDRESS);
          setNfts(data);
        } catch (error) {
          console.error("Failed to fetch NFTs:", error);
        } finally {
          setIsLoadingNFTs(false);
        }
      };

      loadNFTs();
    }
  }, [activeTab, nfts.length]);

  // Handlers
  const handleToggleVisibility = () => {
    setIsBalanceVisible(!isBalanceVisible);
  };

  const handleIrisScanPress = () => {
    // TODO: Implement iris scan functionality
    console.log("Iris scan pressed");
  };

  const handleSettingsPress = () => {
    const currentRoute = pathname || "/wallet";
    const tabParam = params.tab ? `?tab=${params.tab}` : "";
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute + tabParam)}` as any);
  };

  const handleSendPress = () => {
    router.push("/send" as any);
  };

  const handleReceivePress = () => {
    router.push("/receive" as any);
  };

  const handlePayPress = () => {
    // TODO: Navigate to pay screen
    console.log("Pay pressed");
  };

  const handleActivitiesPress = () => {
    router.push("/wallet" as any);
  };

  const handleRewardsPress = () => {
    // TODO: Expand rewards card or navigate to rewards screen
    console.log("Rewards pressed");
  };

  const handleFilterPress = () => {
    setIsFilterModalVisible(true);
  };

  const handleCloseFilterModal = () => {
    setIsFilterModalVisible(false);
  };

  // Apply filters to assets - reactive to filter changes
  const filteredAssets = useMemo(() => {
    if (!walletData) return [];
    return applyFilters(
      walletData.portfolio,
      sortBy,
      tokenCategories,
      chains
    );
  }, [
    walletData,
    sortBy,
    Array.from(tokenCategories).join(","),
    Array.from(chains).join(","),
  ]);

  const handleNFTPress = (nft: NFTItem) => {
    // Navigate to NFT detail and preserve the current tab in the URL
    router.push(`/nft/${nft.id}?tab=${activeTab}` as any);
  };

  const handleTabChange = (tab: WalletTabKey) => {
    setActiveTab(tab);
  };

  const handleTodayPress = () => {
    // TODO: Show time period selector
    console.log("Today pressed");
  };

  if (isLoading || !walletData) {
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
          walletAddress={walletData.address}
          onIrisScanPress={handleIrisScanPress}
          onSettingsPress={handleSettingsPress}
        />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 76 + 24, // Bottom nav height + padding
          alignItems: "center",
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content Container (356px width from Figma, centered) */}
        <View
          style={{
            width: 356,
            maxWidth: "100%",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Top Section: Balance + Quick Actions + Rewards */}
          <View
            style={{
              width: "100%",
              flexDirection: "column",
              gap: 18,
              alignItems: "center",
            }}
          >
            {/* Balance + Quick Actions Container */}
            <View
              style={{
                width: "100%",
                flexDirection: "column",
                gap: 10,
                alignItems: "center",
              }}
            >
              {/* Total Balance Card */}
              <TotalBalanceCard
                totalBalance={walletData.totalBalance}
                portfolioChange={walletData.portfolioChange}
                isBalanceVisible={isBalanceVisible}
                onToggleVisibility={handleToggleVisibility}
                onTodayPress={handleTodayPress}
              />

              {/* Quick Actions */}
              <QuickActions
                onSendPress={handleSendPress}
                onReceivePress={handleReceivePress}
                onPayPress={handlePayPress}
                onActivitiesPress={handleActivitiesPress}
              />
            </View>

            {/* Claimable Rewards Card */}
            <ClaimableRewardsCard
              amount={walletData.claimableRewards}
              onPress={handleRewardsPress}
            />
          </View>

          {/* Assets Section */}
          <View
            style={{
              width: "100%",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* Tab Switcher */}
            <AssetsTabSwitcher
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onFilterPress={handleFilterPress}
            />

            {/* Asset List */}
            {activeTab === "assets" && (
              <View
                style={{
                  width: "100%",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {filteredAssets.map((asset) => (
                  <AssetListItem
                    key={asset.id}
                    asset={asset}
                    onPress={() => {
                      // Store the asset before navigation for context
                      assetStore.setCurrentAsset(asset);
                      router.push(`/asset/${asset.id}?tab=${activeTab}` as any);
                    }}
                  />
                ))}
              </View>
            )}

            {/* NFTs Tab */}
            {activeTab === "nfts" && (
              <View
                style={{
                  width: "100%",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {isLoadingNFTs ? (
                  <View
                    style={{
                      width: "100%",
                      padding: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* TODO: Add skeleton loading UI */}
                  </View>
                ) : (
                  <NFTList nfts={nfts} onNFTPress={handleNFTPress} />
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Filter Modal */}
      <FilterModal
        visible={isFilterModalVisible}
        onClose={handleCloseFilterModal}
      />
    </View>
  );
}
