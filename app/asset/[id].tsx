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
import { ReceiptViewerModal } from "@/components/sections/Send";
import { TransactionReceipt } from "@/components/sections/Send/TransactionReceiptCard";
import { AssetQuickActions } from "@/components/sections/Wallet/AssetQuickActions";
import { WalletHeader } from "@/components/sections/Wallet/WalletHeader";
import { CustomStatusBar } from "@/components/ui/custom-status-bar";
import { colors } from "@/constants/colors";
import { useChains } from "@/hooks/useChains";
import { useResolvedReceivedAmounts } from "@/hooks/useResolvedReceivedAmounts";
import { useUnifiedActivities } from "@/hooks/useUnifiedActivities";
import {
  fetchAssetDetail,
  type AssetActivity,
  type AssetDetail as AssetDetailType,
  type ChartTimePeriod,
} from "@/services/walletService";
import { useAssetStore } from "@/store/assetStore";
import { useSendStore } from "@/store/sendStore";
import { useSwapStore } from "@/store/swapStore";
import { useWalletStore } from "@/store/walletStore";
import { mapAssetToChainOption, mapAssetToTokenOption } from "@/utils/assetMapping";
import { buildReceiptFromActivity } from "@/utils/buildReceiptFromActivity";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

  // Fetch unified activities base on wallet address
  const { data: unifiedActivities } = useUnifiedActivities(100);

  // Resolve any Swap/Received rows whose amount is missing against the
  // on-chain tx so we can (a) drop mislogged swaps that are actually pure
  // sends and (b) prefer concretely-typed rows when deduping by hash.
  const resolvedReceived = useResolvedReceivedAmounts(unifiedActivities || [], WALLET_ADDRESS);

  const { data: chains } = useChains();
  const [viewingReceipt, setViewingReceipt] = useState<TransactionReceipt | null>(null);

  const handleReceiptPress = (activityId: string) => {
    const underlying = unifiedActivities?.find(u => u.id === activityId);
    if (!underlying || !underlying.hash) {
      return;
    }
    const r = buildReceiptFromActivity(underlying, WALLET_ADDRESS, chains);
    if (r) setViewingReceipt(r);
  };

  // Filter and map activities specifically for this token
  const tokenActivities = useMemo(() => {
    const mappedUnifiedForAsset: AssetActivity[] = [];

    if (unifiedActivities && unifiedActivities.length > 0 && asset) {
      const tokenSymbol = asset.symbol.toUpperCase();
      const searchAddr = asset.address.toLowerCase();

      const relevantActivities = unifiedActivities.filter(act => {
        const actSymbol = (act.tokenSymbol || act.metadata?.tokenSymbol || act.metadata?.symbol || '').toUpperCase();
        const actAssetId = (act.metadata?.assetId || act.metadata?.tokenAddress || '').toLowerCase();

        const actChainId = act.chainId || act.metadata?.chainId;
        const isChainMatch = !actChainId || !asset.chainId || Number(actChainId) === Number(asset.chainId);

        const isSymbolMatch = actSymbol === tokenSymbol;
        const isAddressMatch = actAssetId === searchAddr;
        const isNativeMatch = tokenSymbol === 'ETH' && (!actSymbol || actSymbol === 'ETH');

        return isChainMatch && (isSymbolMatch || isAddressMatch || isNativeMatch);
      });

      relevantActivities.forEach(act => {
        const typeLower = (act.category || act.type || '').toLowerCase();
        const titleLower = (act.title || '').toLowerCase();
        const isSwapLogged = typeLower === 'swap' || titleLower.includes('swapped');

        const actChainId = act.chainId || act.metadata?.chainId;
        const probeDirection: 'received' | 'sent' = isSwapLogged || typeLower.includes('receive')
          ? 'received'
          : 'sent';
        const key = act.hash && actChainId
          ? `${actChainId}:${act.hash.toLowerCase()}:${probeDirection}`
          : null;
        const onChain = key ? resolvedReceived[key] : null;

        // Classify using the same rules as the main Activities screen:
        // when on-chain disagrees with the stored category, trust on-chain.
        // A tx logged as "Swap" whose resolver determines there's no
        // received leg is actually a pure Send — relabel it.
        let mappedType: AssetActivity["type"] = "swap";
        if (onChain?.resolvedDirection === 'sent'
          && !typeLower.includes('received') && !typeLower.includes('receive')) {
          mappedType = 'sent';
        }
        else if (onChain?.resolvedDirection === 'received'
          && (typeLower.includes('receive') || titleLower.includes('receive'))) {
          mappedType = 'received';
        }
        else if (typeLower.includes('receive') || titleLower.includes('receive')) {
          mappedType = 'received';
        }
        else if (typeLower.includes('send') || typeLower.includes('transfer') || titleLower.includes('send')) {
          mappedType = 'sent';
        }
        else if (isSwapLogged) {
          mappedType = 'swap';
        }
        else if (typeLower.includes('stake') && !typeLower.includes('unstake')) {
          mappedType = 'stake';
        }
        else if (typeLower.includes('unstake')) {
          mappedType = 'unstake';
        }

        const amountVal = act.amount || act.metadata?.amount || act.metadata?.fromAmount || '0';
        const actSymbol = act.tokenSymbol || act.metadata?.tokenSymbol || act.metadata?.symbol || tokenSymbol;

        const rawAmount = amountVal.toString().replace(new RegExp(`\\s*${actSymbol}$`, 'i'), '').trim();
        const displayAmount = `${rawAmount} ${actSymbol}`;

        const usdVal = act.usdValue || act.metadata?.usdValue || '$0.00';

        mappedUnifiedForAsset.push({
          id: act.id,
          type: mappedType,
          amount: displayAmount,
          usdValue: usdVal,
          usdAmount: parseFloat(usdVal.replace(/[$,]/g, '') || '0'),
          timestamp: act.timestamp,
          date: act.date || new Date(act.timestamp).toLocaleDateString(),
          // Carry the hash so we can dedupe across the server-side
          // asset.activities and the unified-activity mapping.
          ...({ __hash: act.hash?.toLowerCase() } as any),
        });
      });
    }

    // `asset.activities` (fetched via fetchAssetDetail) hits the same
    // backend endpoint as useUnifiedActivities and returns the same txs —
    // but labeled as "Swap" for rows the logger mislabeled. Merging it
    // produces duplicate ghost Swap rows alongside the real Sent rows
    // from the unified pipeline. Use unified only; fall back to
    // `asset.activities` only if unified is empty.
    const merged = new Map<string, AssetActivity>();
    const ingest = (a: AssetActivity) => {
      const raw: string = (a as any).__hash || (a as any).hash || a.id;
      const key = String(raw).toLowerCase();
      if (!merged.has(key)) merged.set(key, a);
    };

    if (mappedUnifiedForAsset.length > 0) {
      mappedUnifiedForAsset.forEach(ingest);
    } else {
      (asset?.activities || []).forEach(ingest);
    }

    return Array.from(merged.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [unifiedActivities, asset, resolvedReceived]);

  // Fetch asset detail for full data (activities, chart)
  useEffect(() => {
    const loadAssetDetail = async () => {
      if (!id) return;

      // If we don't have initial asset data, show loading
      if (!asset) setIsLoading(true);

      try {
        const data = await fetchAssetDetail(id);

        let mergedResult: any = null;
        setAsset(prev => {
          const merged = prev ? {
            ...prev,
            activities: data.activities && data.activities.length > 0 ? data.activities : prev.activities,
            chartData: data.chartData || prev.chartData
          } : data;
          mergedResult = merged;
          return merged;
        });
        // Update the store outside the setState updater to avoid
        // "Cannot update a component while rendering another" warning
        if (mergedResult) assetStore.setCurrentAsset(mergedResult);
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
            activities={tokenActivities}
            onViewAllPress={handleViewAllPress}
            onReceiptPress={handleReceiptPress}
          />
        </View>
      </ScrollView>

      <ReceiptViewerModal
        visible={!!viewingReceipt}
        receipt={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />
    </View>
  );
}

