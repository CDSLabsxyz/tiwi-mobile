import { Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/ui/custom-tab-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/theme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          title: 'Swap',
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: 'Earn',
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
        }}
      />
      <Tabs.Screen
        name="bridge"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
