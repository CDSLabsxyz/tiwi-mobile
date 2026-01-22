import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Header } from '@/components/ui/Header';
import { BottomNav } from '@/components/ui/BottomNav';
import { WalletModal } from '@/components/ui/WalletModal';
import { NewsfeedSection } from '@/components/sections/NewsfeedSection';
import { QuickActionsSection } from '@/components/sections/QuickActionsSection';
import { StakeBanner } from '@/components/sections/StakeBanner';
import { SpotlightSection } from '@/components/sections/SpotlightSection';
import { MarketSection } from '@/components/sections/MarketSection';
import { TradeStatsSection } from '@/components/sections/TradeStatsSection';
import { SmartMarketsSection } from '@/components/sections/SmartMarketsSection';
import { fetchHomeData } from '@/services/mockData';
import { HomeData } from '@/types';
import { colors } from '@/theme';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { WALLET_ADDRESS } from '@/utils/wallet';
import { Image } from '@/tw';
import { useUIStore } from '@/store';

/**
 * Home Screen
 * Main screen of the app matching Figma design exactly
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
  const { isWalletModalVisible, openWalletModal, closeWalletModal } = useUIStore();
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string }>();

  useEffect(() => {
    const loadData = async () => {
      const homeData = await fetchHomeData();
      setData(homeData);
    };
    loadData();
  }, []);

  const handleWalletPress = () => {
    openWalletModal();
  };

  const handleCloseModal = () => {
    closeWalletModal();
  };

  const handleHistoryPress = () => {
    closeWalletModal();
    router.push('/wallet' as any);
  };

  const handleSettingsPress = () => {
    closeWalletModal();
    const currentRoute = pathname || "/";
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
  };

  const handleDisconnectPress = () => {
    closeWalletModal();
    // Handle disconnect wallet logic
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
    >
      <StatusBar />
      <Header 
        walletAddress={WALLET_ADDRESS}
        onWalletPress={handleWalletPress} 
        onSettingsPress={handleSettingsPress}
      />
      
      {/* Wallet Modal */}
      <WalletModal
        visible={isWalletModalVisible}
        onClose={handleCloseModal}
        walletAddress={WALLET_ADDRESS}
        onHistoryPress={handleHistoryPress}
        onSettingsPress={handleSettingsPress}
        onDisconnectPress={handleDisconnectPress}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 76 + 24, // Bottom nav height + padding
          alignItems: 'center',
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Newsfeed Banner */}
        <NewsfeedSection
          items={data.newsfeed}
          isLoading={data.isLoading}
        />

        {/* Quick Actions */}
        <QuickActionsSection />

        {/* Stake Banner */}
        <StakeBanner />

        {/* Spotlight */}
        <SpotlightSection
          tokens={data.spotlight}
          isLoading={data.isLoading}
        />

        {/* Market Section */}
        <MarketSection
          pairs={data.tradingPairs}
          isLoading={data.isLoading}
        />

        {/* Trade Stats */}
        <TradeStatsSection
          stats={data.stats}
          isLoading={data.isLoading}
        />

        {/* Smart Markets */}
        <SmartMarketsSection
          markets={data.dexMarkets}
          isLoading={data.isLoading}
        />
      </ScrollView>

      <BottomNav />

      {/* Fixed AI Button - Right Side */}
      <TouchableOpacity
        onPress={() => router.push('/chatbot' as any)}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          right: 20,
          top: '50%',
          marginTop: 16.5, // Adjust based on design
          zIndex: 1000,
          elevation: 10, // Android shadow
          width: 48,
          height: 48,
        }}
      >
        <Image
          source={require('../assets/home/connect wallet.svg')}
          className="w-full h-full"
          contentFit="contain"
        />
      </TouchableOpacity>
    </View>
  );
}
