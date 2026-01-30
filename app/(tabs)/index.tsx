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
import { WalletModal } from '@/components/ui/wallet-modal';
import { colors } from '@/constants/colors';


import { useChains } from '@/hooks/useChains';
import { useSpotlightTokens } from '@/hooks/useSpotlightTokens';
import { useTWCToken } from '@/hooks/useTWCToken';
import { formatNumber, formatUSDPrice } from '@/utils/formatting';

import { MarketSection } from '@/components/features/home/market-section';
import { NewsfeedSection } from '@/components/features/home/newsfeed-section';
import { QuickActionsSection } from '@/components/features/home/quick-actions-section';
import { SmartMarketsSection } from '@/components/features/home/smart-markets-section';
import { SpotlightSection } from '@/components/features/home/spotlight-section';
import { StakeBanner } from '@/components/features/home/stake-banner';
import { TradeStatsSection } from '@/components/features/home/trade-stats-section';
import { apiClient } from '@/services/apiClient';
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

  const { isConnected, disconnect } = useWalletStore();
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Queries
  const {
    data: spotlightTokens = [],
    isLoading: isLoadingSpotlight,
    isRefetching: isRefetchingSpotlight
  } = useSpotlightTokens();

  // const {
  //   data: marketPrice,
  //   isLoading: isLoadingMarket,
  //   isRefetching: isRefetchingMarket
  // } = useMarketPrice('TWC-USDT');

  const {
    data: chains = [],
    isLoading: isLoadingChains,
  } = useChains();

  const {
    data: twcToken,
    isLoading: isLoadingTWCToken,
  } = useTWCToken();

  // Staggered Prefetching for Market Section
  // Staggered Prefetching for Market Section
  // const { favorites } = useWalletStore(); // Removed invalid property
  const { favorites: marketFavorites } = useMarketStore();

  React.useEffect(() => {
    const categories: ('hot' | 'new' | 'gainers' | 'losers')[] = ['hot', 'new', 'gainers', 'losers'];

    // Prefetch each category in sequence to avoid overwhelming the network
    const prefetch = async () => {
      // 1. Prefetch Spotlight (User explicitly asked for this on homepage)
      queryClient.prefetchQuery({
        queryKey: ['spotlightTokens', true],
        queryFn: () => apiClient.getSpotlightTokens(true),
      });

      // 2. Prefetch Market Categories
      for (const category of categories) {
        queryClient.prefetchQuery({
          queryKey: ['tokens', category, 5, undefined],
          queryFn: () => apiClient.getMarketPairs({ category, limit: 5 }),
          staleTime: 60 * 1000,
        });
        // Slight delay between prefetches
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 3. Prefetch Favorites if any
      if (marketFavorites.length > 0) {
        for (const id of marketFavorites) {
          const [chainId, address] = id.split('-');
          queryClient.prefetchQuery({
            queryKey: ['tokens', address, [parseInt(chainId)], 1],
            queryFn: () => apiClient.getTokens({ address, chains: [parseInt(chainId)], limit: 1 }),
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
      queryClient.invalidateQueries({ queryKey: ['market-pairs'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const isGlobalLoading = isLoadingSpotlight;

  // Combined data for sections (mocking newsfeed/smart markets for now)
  const homeData = useMemo(() => {
    return {
      newsfeed: [
        { id: '1', imageUrl: require('../../assets/home/banner.svg') },
        { id: '2', imageUrl: require('../../assets/home/banner.svg') },
      ],
      spotlight: spotlightTokens.map(t => ({
        id: t.id,
        symbol: t.symbol,
        logo: t.logo || 'https://www.figma.com/api/mcp/asset/3cea74db-4833-4e82-a07c-0e5e220b5a54',
        change24h: 0,
      })),
      tradingPairs: [
        {
          id: '1',
          baseSymbol: 'ETH',
          quoteSymbol: 'USDT',
          logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
          price: '$2,720.55',
          change24h: -5.17,
          volume: 'Vol $972.89M',
          leverage: '10X',
        },
      ],
      stats: [
        {
          id: 'twc-price',
          icon: require('../../assets/home/tiwicat-token.svg'),
          value: twcToken ? formatUSDPrice(twcToken.priceUSD || '0') : '$0.00',
          label: 'TWC Token Price',
          iconType: 'image' as const,
        },
        {
          id: 'chain-count',
          icon: 'chains',
          value: `${chains.length > 0 ? chains.length : 50}+`,
          label: 'Active Chains',
          iconType: 'icon' as const,
        },
        {
          id: 'twc-mcap',
          icon: 'locked',
          value: twcToken?.marketCap ? `$${formatNumber(twcToken.marketCap)}` : 'N/A',
          label: 'Market Cap',
          iconType: 'icon' as const,
        },
        {
          id: 'twc-vol',
          icon: 'trade-up',
          value: twcToken?.volume24h ? `$${formatNumber(twcToken.volume24h)}` : 'N/A',
          label: '24h Volume',
          iconType: 'icon' as const,
        },
        {
          id: 'twc-holders',
          icon: 'coins',
          value: twcToken?.holders ? formatNumber(twcToken.holders, 0) : 'N/A',
          label: 'Holders',
          iconType: 'icon' as const,
        },
      ],
      dexMarkets: [
        { id: '1', name: 'Uniswap', logo: 'https://cryptologos.cc/logos/uniswap-uni-logo.png' },
      ],
      isLoading: isLoadingSpotlight || isLoadingChains || isLoadingTWCToken,
    };
  }, [spotlightTokens, isLoadingSpotlight, chains, twcToken, isLoadingChains, isLoadingTWCToken]);

  const handleOpenWallet = () => {
    setIsWalletModalVisible(true);
  };

  const handleCloseWallet = () => {
    setIsWalletModalVisible(false);
  };

  const handleWalletHistory = () => {
    setIsWalletModalVisible(false);
    router.push('/wallet' as any);
  };

  const handleWalletSettings = () => {
    setIsWalletModalVisible(false);
    router.push('/settings' as any);
  };

  const handleDisconnect = () => {
    setIsWalletModalVisible(false);
    disconnect();
  };

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

        <WalletModal
          visible={isWalletModalVisible}
          onClose={handleCloseWallet}
          onHistoryPress={handleWalletHistory}
          onSettingsPress={handleWalletSettings}
          onDisconnectPress={handleDisconnect}
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
            <SpotlightSection tokens={homeData.spotlight} isLoading={homeData.isLoading} />
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