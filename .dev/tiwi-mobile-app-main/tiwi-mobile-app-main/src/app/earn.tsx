/**
 * Earn Screen
 * Main earn/staking page with tab navigation
 * Matches Figma design exactly (node-ids: 3279-111179, 3279-112371, 3279-112390)
 */

import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { BottomNav } from '@/components/ui/BottomNav';
import {
  EarnTabSwitcher,
  StakingCarousel,
  StakingTokenCard,
  ComingSoon,
  type EarnTabKey,
} from '@/components/sections/Earn';
import { colors } from '@/theme';
import { WALLET_ADDRESS } from '@/utils/wallet';
import { WalletHeader } from '@/components/sections/Wallet/WalletHeader';
import { useRouter, usePathname } from 'expo-router';

// Mock token icon - in production, use actual token logo
// Using tiwicat icon as placeholder for TWC token
const TWCIcon = require('@/assets/home/tiwicat.svg');

type StakingSubTab = 'stake' | 'active' | 'my-stakes';

export default function EarnScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<EarnTabKey>('staking');
  const [stakingSubTab, setStakingSubTab] = useState<StakingSubTab>('stake');

  const handleSettingsPress = () => {
    const currentRoute = pathname || '/earn';
    router.push(`/settings?returnTo=${encodeURIComponent(currentRoute)}` as any);
  };

  const handleIrisScanPress = () => {
    // TODO: Implement iris scan functionality
    console.log('Iris scan pressed');
  };

  // Mock data - in production, fetch from API
  const totalStaked = '213,111,612 TWC';
  const stakingTokens = [
    {
      symbol: 'TWC',
      name: 'TIWI',
      apy: '~12.5%',
      icon: TWCIcon,
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />

      {/* Header */}
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
        />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 76 + 24,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* Tab Switcher */}
          <EarnTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Staking Tab Content */}
          {activeTab === 'staking' && (
            <View
              style={{
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Total TWC Staked Card */}
              <View
                style={{
                  backgroundColor: colors.bgSemi,
                  borderWidth: 0.5,
                  borderColor: '#273024',
                  height: 56,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  position: 'relative',
                }}
              >
                {/* Vertical Divider */}
                <View
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: '#273024',
                    transform: [{ rotate: '90deg' }],
                  }}
                />

                {/* Left: Label */}
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 16,
                      color: colors.primaryCTA,
                      letterSpacing: -0.64,
                    }}
                  >
                    Total TWC Staked
                  </Text>
                </View>

                {/* Right: Amount */}
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 16,
                      color: colors.titleText,
                      letterSpacing: -0.64,
                    }}
                  >
                    {totalStaked}
                  </Text>
                </View>
              </View>

              {/* Staking Carousel */}
              <StakingCarousel />

              {/* Staking Sub Tabs */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                {/* Stake Tab */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setStakingSubTab('stake')}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      color: colors.titleText,
                    }}
                  >
                    Stake
                  </Text>
                  {stakingSubTab === 'stake' && (
                    <View
                      style={{
                        height: 1,
                        width: 16,
                        backgroundColor: colors.titleText,
                      }}
                    />
                  )}
                </TouchableOpacity>

                {/* Active Positions Tab */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setStakingSubTab('active')}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      color: colors.mutedText,
                    }}
                  >
                    Active Positions
                  </Text>
                  {stakingSubTab === 'active' && (
                    <View
                      style={{
                        height: 1,
                        width: 16,
                        backgroundColor: colors.titleText,
                      }}
                    />
                  )}
                </TouchableOpacity>

                {/* My Stakes Tab */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setStakingSubTab('my-stakes')}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Medium',
                      fontSize: 14,
                      color: colors.mutedText,
                    }}
                  >
                    My Stakes
                  </Text>
                  {stakingSubTab === 'my-stakes' && (
                    <View
                      style={{
                        height: 1,
                        width: 16,
                        backgroundColor: colors.titleText,
                      }}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* Staking Token Cards */}
              {stakingSubTab === 'stake' && (
                <View
                  style={{
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {stakingTokens.map((token, index) => (
                    <StakingTokenCard
                      key={index}
                      tokenSymbol={token.symbol}
                      tokenName={token.name}
                      apy={token.apy}
                      tokenIcon={token.icon}
                    />
                  ))}
                </View>
              )}

              {/* Active Positions / My Stakes Content */}
              {(stakingSubTab === 'active' || stakingSubTab === 'my-stakes') && (
                <View
                  style={{
                    minHeight: 200,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Manrope-Regular',
                      fontSize: 14,
                      color: colors.mutedText,
                    }}
                  >
                    No {stakingSubTab === 'active' ? 'active positions' : 'stakes'} yet
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Coming Soon Tabs */}
          {(activeTab === 'farming' ||
            activeTab === 'lend-borrow' ||
            activeTab === 'nft-staking') && <ComingSoon />}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
