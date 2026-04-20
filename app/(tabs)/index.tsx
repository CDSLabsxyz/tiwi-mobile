import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
import { colors } from '@/constants/colors';


import { useChains } from '@/hooks/useChains';
import { useSmartMarkets } from '@/hooks/useSmartMarkets';
import { useSpotlightTokens } from '@/hooks/useSpotlightTokens';
import { useTWCSupply } from '@/hooks/useTWCSupply';
import { useTWCToken } from '@/hooks/useTWCToken';
import { formatCompactNumber, formatNumber } from '@/utils/formatting';

import { MarketSection } from '@/components/features/home/market-section';
import { NewsfeedSection } from '@/components/features/home/newsfeed-section';
import { QuickActionsSection } from '@/components/features/home/quick-actions-section';
import { SmartMarketsSection } from '@/components/features/home/smart-markets-section';
import { SpotlightSection } from '@/components/features/home/spotlight-section';
import { StakeBanner } from '@/components/features/home/stake-banner';
import { UpdateBanner } from '@/components/features/home/update-banner';
import { TradeStatsSection } from '@/components/features/home/trade-stats-section';
import { usePrice, useTranslation } from '@/hooks/useLocalization';
import { api } from '@/lib/mobile/api-client';
import { useMarketStore } from '@/store/marketStore';
import { useWalletStore } from '@/store/walletStore';
import { useQueryClient } from '@tanstack/react-query';

export default function HomeScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Background Prefetching: Hydrate the market cache as soon as the user lands on Home
  // This ensures the Market tab is instant and layout-ready when clicked.
  React.useEffect(() => {
    // Prefetch the default market view ('all') so Market tab is instant
    queryClient.prefetchQuery({
      queryKey: ['enrichedMarkets', 'all', 250],
      queryFn: () => api.market.list({ marketType: 'all', limit: 250 }).then(r => r.markets || []),
      staleTime: 60 * 1000,
    });
  }, [queryClient]);

  const { isConnected, disconnect, setWalletModalVisible } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);

  // Queries (Moved up so formatted variables can access them)
  const {
    data: spotlightTokens = [],
    isLoading: isLoadingSpotlight,
  } = useSpotlightTokens();

  const {
    data: chains = [],
    isLoading: isLoadingChains,
  } = useChains();

  const {
    data: twcToken,
    isLoading: isLoadingTWCToken,
  } = useTWCToken();

  const {
    data: smartMarkets = [],
    isLoading: isLoadingSmartMarkets,
  } = useSmartMarkets();

  // Live TWC supply from the TIWI ecosystem API. Falls back to the
  // static genesis supply if the endpoint is unreachable, so the home
  // tile never renders N/A.
  const { data: twcSupply, isLoading: isLoadingTWCSupply } = useTWCSupply();
  const formattedTWCTotalSupply = useMemo(() => {
    const fromSupplyApi = twcSupply?.totalSupply;
    const fromTokenApi = twcToken?.totalSupply;
    const value = fromSupplyApi || fromTokenApi;
    if (!value || value <= 0) return 'N/A';
    return formatCompactNumber(value, { decimals: 2 });
  }, [twcSupply?.totalSupply, twcToken?.totalSupply]);

  // Formatting Hook
  const formattedTWCPrice = usePrice(twcToken?.priceUSD || 0);
  const formattedTWCMcap = usePrice(twcToken?.marketCap || 0);
  const formattedTWCVol = usePrice(twcToken?.volume24h || 0);

  const { favorites: marketFavorites } = useMarketStore();

  React.useEffect(() => {
    const categories: ('hot' | 'new' | 'gainers' | 'losers')[] = ['hot', 'new', 'gainers', 'losers'];
    const prefetch = async () => {
      queryClient.prefetchQuery({
        queryKey: ['spotlightTokens'],
        queryFn: () => api.tokenSpotlight.get(),
      });

      // Removed smartMarkets prefetch if deprecated or merged into tokens.list
      // queryClient.prefetchQuery({
      //   queryKey: ['smartMarkets'],
      //   queryFn: () => api.tokens.list({ category: 'hot', limit: 30 }),
      // });

      for (const category of categories) {
        queryClient.prefetchQuery({
          queryKey: ['tokens', category, 5, undefined],
          queryFn: () => api.market.pairs({ category, limit: 5 }),
          staleTime: 60 * 1000,
        });
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (marketFavorites.length > 0) {
        for (const id of marketFavorites) {
          const [chainId, address] = id.split('-');
          queryClient.prefetchQuery({
            queryKey: ['tokens', address, [parseInt(chainId)], 1],
            queryFn: () => api.tokens.list({ address, chains: [parseInt(chainId)], limit: 1 }),
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    };
    prefetch();
  }, [queryClient, marketFavorites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['spotlightTokens'] }),
      queryClient.invalidateQueries({ queryKey: ['marketPrice'] }),
      queryClient.invalidateQueries({ queryKey: ['walletBalances'] }),
      queryClient.invalidateQueries({ queryKey: ['chains'] }),
      queryClient.invalidateQueries({ queryKey: ['twcToken'] }),
      queryClient.invalidateQueries({ queryKey: ['twcSupply'] }),
      queryClient.invalidateQueries({ queryKey: ['smartMarkets'] }),
      queryClient.invalidateQueries({ queryKey: ['market-pairs'] }),
      queryClient.invalidateQueries({ queryKey: ['tokens'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const homeData = useMemo(() => {
    return {
      newsfeed: [
        { id: '1', imageUrl: require('../../assets/home/banner.svg') },
        { id: '2', imageUrl: require('../../assets/home/frame-referral.png') },
      ],
      spotlight: spotlightTokens.map(t => ({
        id: t.id,
        symbol: t.symbol,
        logo: t.logo || 'https://www.figma.com/api/mcp/asset/3cea74db-4833-4e82-a07c-0e5e220b5a54',
        change24h: t.change24h || 0,
      })),
      stats: [
        {
          id: 'twc-price',
          icon: require('../../assets/home/tiwicat-token.svg'),
          value: formattedTWCPrice,
          label: t('home.twc_price'),
          iconType: 'image' as const,
        },
        {
          id: 'chain-count',
          icon: 'chains',
          value: `${chains.length > 0 ? chains.length : 50}+`,
          label: t('home.active_chains'),
          iconType: 'icon' as const,
        },
        {
          id: 'twc-mcap',
          icon: 'locked',
          value: formattedTWCMcap,
          label: t('home.market_cap'),
          iconType: 'icon' as const,
        },
        {
          id: 'twc-vol',
          icon: 'trade-up',
          value: formattedTWCVol,
          label: t('home.volume_24h'),
          iconType: 'icon' as const,
        },
        {
          id: 'twc-total-supply',
          icon: 'coins',
          value: formattedTWCTotalSupply,
          label: t('home.total_supply'),
          iconType: 'icon' as const,
        },
      ],
      dexMarkets: smartMarkets.slice(0, 15).map(m => ({
        id: m.id,
        name: m.name,
        logo: m.logo
      })),
      isLoading: isLoadingSpotlight || isLoadingChains || isLoadingTWCToken || isLoadingSmartMarkets || isLoadingTWCSupply,
    };
  }, [spotlightTokens, isLoadingSpotlight, chains, twcToken, isLoadingChains, isLoadingTWCToken, smartMarkets, isLoadingSmartMarkets, isLoadingTWCSupply, formattedTWCPrice, formattedTWCMcap, formattedTWCVol, formattedTWCTotalSupply, t]);

  const handleOpenWallet = useCallback(() => {
    console.log('[HomeScreen] Opening Global Wallet Modal...');
    setWalletModalVisible(true);
  }, [setWalletModalVisible]);

  // Modal logic is now handled in TabLayout
  // But we keep handleOpenWallet as a legacy delegate for the Header

  return (
      <ThemedView style={styles.container}>
        <CustomStatusBar />
        <Header
          onWalletPress={handleOpenWallet}
          onSettingsPress={() => router.push('/settings' as any)}
        />



        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: (bottom || 16) + 76 + 24 }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryCTA}
              colors={[colors.primaryCTA]}
              progressViewOffset={top}
            />
          }
        >
          <NewsfeedSection items={homeData.newsfeed} isLoading={homeData.isLoading} />

          <View style={styles.paddedContent}>
            <QuickActionsSection />
            <UpdateBanner />
            <StakeBanner />
            {(homeData.spotlight.length > 0 || homeData.isLoading) && (
              <SpotlightSection
                tokens={homeData.spotlight}
                isLoading={homeData.isLoading}
                onTokenPress={(token) => {
                  const marketId = token.pair || token.symbol;
                  router.push({
                    pathname: `/market/spot/${marketId}` as any,
                    params: {
                      symbol: marketId,
                      address: (token as any).address,
                      chainId: (token as any).chainId || 56,
                      provider: 'onchain'
                    }
                  });
                }}
              />
            )}
            <MarketSection isLoading={homeData.isLoading} />
            <TradeStatsSection stats={homeData.stats} chains={chains} isLoading={homeData.isLoading} />
            <SmartMarketsSection markets={homeData.dexMarkets} isLoading={homeData.isLoading} />
          </View>
        </ScrollView>

        {/* Floating AI bubble is mounted globally in app/_layout.tsx */}

        {/* WalletModal moved to Layout */}
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12, // Reduced top padding for banners
    alignItems: 'center',
    gap: 24,
  },
  paddedContent: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 24,
    alignItems: 'center',
  }
});