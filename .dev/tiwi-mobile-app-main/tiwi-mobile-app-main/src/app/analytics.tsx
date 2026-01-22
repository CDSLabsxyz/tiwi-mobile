import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from '@/components/ui/StatusBar';
import { Header } from '@/components/ui/Header';
import { BottomNav } from '@/components/ui/BottomNav';
import { colors } from '@/theme';
import { WALLET_ADDRESS } from '@/utils/wallet';

export default function AnalyticsScreen() {
  const { bottom } = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <StatusBar />
      <Header walletAddress={WALLET_ADDRESS} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: (bottom || 16) + 76 + 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          className="text-2xl"
          style={{
            fontFamily: 'Manrope-Bold',
            fontSize: 24,
            color: colors.titleText,
          }}
        >
          Analytics Screen
        </Text>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

