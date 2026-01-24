import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
import { WalletModal } from '@/components/ui/wallet-modal';
import { colors } from '@/constants/colors';

import { MarketSection } from '@/components/features/home/market-section';
import { NewsfeedSection } from '@/components/features/home/newsfeed-section';
import { QuickActionsSection } from '@/components/features/home/quick-actions-section';
import { SmartMarketsSection } from '@/components/features/home/smart-markets-section';
import { SpotlightSection } from '@/components/features/home/spotlight-section';
import { StakeBanner } from '@/components/features/home/stake-banner';
import { TradeStatsSection } from '@/components/features/home/trade-stats-section';

import { fetchHomeData } from '@/services/data';
import { HomeData } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_SIZE = 48;
const SNAP_PADDING = 20;

/**
 * Home Screen
 * Matches reference project 1:1
 */
export default function HomeScreen() {
  const [data, setData] = useState<HomeData>({
    newsfeed: [],
    spotlight: [],
    tradingPairs: [],
    stats: [],
    dexMarkets: [],
    isLoading: true,
  });

  // ... existing hooks
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();

  // Wallet Modal State
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);

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
    // You might want to navigate to settings or handle this differently
    router.push('/settings' as any);
  };

  const handleDisconnect = () => {
    setIsWalletModalVisible(false);
    // Implement disconnect logic
    console.log('Disconnect pressed');
  };

  useEffect(() => {
    const loadData = async () => {
      const homeData = await fetchHomeData();
      setData(homeData);
    };
    loadData();
  }, []);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ x: 0, y: 0 });

  // ... gesture definition ...
  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((event) => {
      translateX.value = event.translationX + context.value.x;

      // Calculate absolute Y position to clamp it
      const initialY = SCREEN_HEIGHT / 2 + 16.5; // matching styles.aiButton top 50% + marginTop
      const nextY = event.translationY + context.value.y;

      const tabAreaHeight = (bottom || 16) + 76;
      const topBoundary = -initialY + 100; // Limit roughly below header
      const bottomBoundary = (SCREEN_HEIGHT - initialY) - tabAreaHeight - BUTTON_SIZE - 20;

      translateY.value = Math.min(Math.max(nextY, topBoundary), bottomBoundary);
    })
    .onEnd(() => {
      const centerX = SCREEN_WIDTH / 2;
      const currentAbsoluteX = SCREEN_WIDTH - BUTTON_SIZE - SNAP_PADDING + translateX.value;

      if (currentAbsoluteX < centerX) {
        // Snap to left
        translateX.value = withSpring(-(SCREEN_WIDTH - BUTTON_SIZE - SNAP_PADDING * 2));
      } else {
        // Snap to right
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
            { paddingBottom: (bottom || 16) + 76 + 24, paddingHorizontal: 20 } // Nav height + padding
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Newsfeed */}
          <NewsfeedSection items={data.newsfeed} isLoading={data.isLoading} />

          {/* Quick Actions */}
          <QuickActionsSection />

          {/* Stake Banner */}
          <StakeBanner />

          {/* Spotlight */}
          <SpotlightSection tokens={data.spotlight} isLoading={data.isLoading} />

          {/* Market */}
          <MarketSection pairs={data.tradingPairs} isLoading={data.isLoading} />

          {/* Trade Stats */}
          <TradeStatsSection stats={data.stats} isLoading={data.isLoading} />

          {/* Smart Markets */}
          <SmartMarketsSection markets={data.dexMarkets} isLoading={data.isLoading} />
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
    paddingTop: 24,
    alignItems: 'center',
    gap: 24,
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
