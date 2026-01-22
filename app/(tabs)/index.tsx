import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { Header } from '@/components/ui/header';
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

  const { bottom } = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      const homeData = await fetchHomeData();
      setData(homeData);
    };
    loadData();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <CustomStatusBar />
      <Header />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (bottom || 16) + 76 + 24 } // Nav height + padding
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
      <TouchableOpacity
        onPress={() => router.push('/chatbot' as any)}
        activeOpacity={0.8}
        style={styles.aiButton}
      >
        <Image
          source={require('../../assets/home/connect wallet.svg')}
          style={styles.aiIcon}
          contentFit="contain"
        />
      </TouchableOpacity>
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
    paddingTop: 24,
    alignItems: 'center',
    gap: 24,
  },
  aiButton: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: 16.5,
    zIndex: 1000,
    elevation: 10,
    width: 48,
    height: 48,
  },
  aiIcon: {
    width: '100%',
    height: '100%',
  }
});
