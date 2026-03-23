import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
import { colors } from '@/constants/colors';


import { useChains } from '@/hooks/useChains';
import { useSmartMarkets } from '@/hooks/useSmartMarkets';
import { useSpotlightTokens } from '@/hooks/useSpotlightTokens';
import { useTWCToken } from '@/hooks/useTWCToken';
import { formatCompactNumber, formatNumber } from '@/utils/formatting';

import { MarketSection } from '@/components/features/home/market-section';
import { NewsfeedSection } from '@/components/features/home/newsfeed-section';
import { QuickActionsSection } from '@/components/features/home/quick-actions-section';
import { SmartMarketsSection } from '@/components/features/home/smart-markets-section';
import { SpotlightSection } from '@/components/features/home/spotlight-section';
import { StakeBanner } from '@/components/features/home/stake-banner';
import { TradeStatsSection } from '@/components/features/home/trade-stats-section';
import { usePrice, useTranslation } from '@/hooks/useLocalization';
import { api } from '@/lib/mobile/api-client';
import { useMarketStore } from '@/store/marketStore';
import { useWalletStore } from '@/store/walletStore';
import { useQueryClient } from '@tanstack/react-query';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_SIZE = 48;
const SNAP_PADDING = 20;

export default function HomeScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Background Prefetching: Hydrate the market cache as soon as the user lands on Home
  // This ensures the Market tab is instant and layout-ready when clicked.
  React.useEffect(() => {
    const prefetchMarkets = async () => {
      // 1. Prefetch Spot Markets (Default View)
      queryClient.prefetchQuery({
        queryKey: ['enrichedMarkets', 'spot', 250],
        queryFn: () => api.market.list({ marketType: 'spot', limit: 250 }),
        staleTime: 60 * 1000,
      });

      // 2. Prefetch Perp Markets (Background View)
      queryClient.prefetchQuery({
        queryKey: ['enrichedMarkets', 'perp', 250],
        queryFn: () => api.market.list({ marketType: 'perp', limit: 250 }),
        staleTime: 60 * 1000,
      });
    };

    prefetchMarkets();
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
          id: 'twc-holders',
          icon: 'coins',
          value: twcToken?.holders && twcToken?.holders === twcToken?.transactionCount ? formatCompactNumber(15034) : twcToken?.holders ? formatNumber(twcToken.holders, 0) : 'N/A',
          label: t('home.holders'),
          iconType: 'icon' as const,
        },
      ],
      dexMarkets: smartMarkets.slice(0, 15).map(m => ({
        id: m.id,
        name: m.name,
        logo: m.logo
      })),
      isLoading: isLoadingSpotlight || isLoadingChains || isLoadingTWCToken || isLoadingSmartMarkets,
    };
  }, [spotlightTokens, isLoadingSpotlight, chains, twcToken, isLoadingChains, isLoadingTWCToken, smartMarkets, isLoadingSmartMarkets, formattedTWCPrice, formattedTWCMcap, formattedTWCVol, t]);

  const handleOpenWallet = useCallback(() => {
    console.log('[HomeScreen] Opening Global Wallet Modal...');
    setWalletModalVisible(true);
  }, [setWalletModalVisible]);

  // Modal logic is now handled in TabLayout
  // But we keep handleOpenWallet as a legacy delegate for the Header


  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ x: 0, y: 0 });

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((event) => {
      translateX.value = event.translationX + context.value.x;

      const initialY = SCREEN_HEIGHT / 2 + 16.5;
      const nextY = event.translationY + context.value.y;

      const tabAreaHeight = (bottom || 16) + 76;
      const topBoundary = -initialY + 100;
      const bottomBoundary = (SCREEN_HEIGHT - initialY) - tabAreaHeight - BUTTON_SIZE - 20;

      translateY.value = Math.min(Math.max(nextY, topBoundary), bottomBoundary);
    })
    .onEnd(() => {
      const centerX = SCREEN_WIDTH / 2;
      const currentAbsoluteX = SCREEN_WIDTH - BUTTON_SIZE - SNAP_PADDING + translateX.value;

      if (currentAbsoluteX < centerX) {
        translateX.value = withSpring(-(SCREEN_WIDTH - BUTTON_SIZE - SNAP_PADDING * 2));
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            <StakeBanner />
            {homeData.spotlight.length > 0 && (
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

        {/* Floating AI Bot Button */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.aiButton, animatedStyle]}>
            <TouchableOpacity
              onPress={() => router.push('/chatbot' as any)}
              activeOpacity={0.8}
              style={styles.aiButtonTouch}
            >
              <Image
                source={require('../../assets/home/connect wallet.svg')}
                style={styles.aiIcon}
                contentFit="contain"
              />
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>

        {/* WalletModal moved to Layout */}
      </ThemedView>
    </GestureHandlerRootView>
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
  },
  aiButton: {
    position: 'absolute',
    right: SNAP_PADDING,
    top: '50%',
    marginTop: 16.5,
    zIndex: 1000,
    elevation: 10,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  aiButtonTouch: {
    width: '100%',
    height: '100%',
  },
  aiIcon: {
    width: '100%',
    height: '100%',
  }
});