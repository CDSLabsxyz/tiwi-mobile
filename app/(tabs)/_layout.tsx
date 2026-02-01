import { Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/ui/custom-tab-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/hooks/useLocalization';
import { Colors } from '@/theme';

import { notificationService } from '@/services/notificationService';
import { useWalletStore } from '@/store/walletStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const { address } = useWalletStore();

  React.useEffect(() => {
    if (address) {
      notificationService.registerForPushNotifications(address);
    }
  }, [address]);

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
          title: t('nav.home'),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: t('nav.market'),
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: t('nav.earn'),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('nav.wallet'),
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
      <Tabs.Screen
        name="chatbot"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
