/**
 * Root Layout
 * Handles navigation structure, onboarding, and wallet connection guards
 * Integrated with Reown AppKit and Wagmi
 */

import { prefetchWallets } from '@/services/walletConnectService';
import { appKit, wagmiAdapter } from '@/services/web3Config';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useWalletStore } from '@/store/walletStore';
import '@/utils/polyfills';
import { AppKit, AppKitProvider, useAccount } from '@reown/appkit-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@walletconnect/react-native-compat';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WagmiProvider } from 'wagmi';

// Initialize TanStack Query Client
const queryClient = new QueryClient();

/**
 * Sync component to bridge Wagmi state to our local zustand store
 * This ensures existing navigation guards and UI continue to work seamlessly
 */
function WalletSync() {
  const { address, chainId, isConnected } = useAccount();
  const setConnection = useWalletStore((state: any) => state.setConnection);

  useEffect(() => {
    setConnection({ address: address || null, chainId, isConnected });
  }, [address, chainId, isConnected, setConnection]);

  return null;
}

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  const { hasCompletedOnboarding, isLoading: isOnboardingLoading, checkOnboardingStatus } = useOnboardingStore();
  const { isConnected } = useWalletStore();

  // 1. Initialize app state
  useEffect(() => {
    const init = async () => {
      await checkOnboardingStatus();
      await prefetchWallets();
      setIsNavigationReady(true);
    };
    init();
  }, []);

  // 2. Navigation Guard Logic
  useEffect(() => {
    // Only proceed if everything is loaded and navigation is ready
    if (isOnboardingLoading || !isNavigationReady) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inWelcome = segments[0] === 'welcome';
    const inTabs = segments[0] === '(tabs)';
    const isRoot = segments.length === 0;

    // // A. ONBOARDING GUARD
    // if (!hasCompletedOnboarding) {
    //   if (!inOnboarding) {
    //     router.replace('/onboarding' as any);
    //   }
    // }
    // // B. CONNECTION GUARD
    // else if (!isConnected) {
    //   if (!inWelcome && !inOnboarding) {
    //     router.replace('/welcome' as any);
    //   }
    //   if (inOnboarding) {
    //     router.replace('/welcome' as any);
    //   }
    // }
    // // C. AUTHENTICATED ACCESS
    // else {
    //   if (inOnboarding || inWelcome || isRoot) {
    //     router.replace('/(tabs)/home' as any);
    //   }
    // }

    // Hide splash screen
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, [hasCompletedOnboarding, isConnected, isOnboardingLoading, isNavigationReady, segments]);

  return (
    <SafeAreaProvider>
      <AppKitProvider instance={appKit}>
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <WalletSync />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="welcome" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="send" />
              <Stack.Screen name="receive" />
              <Stack.Screen name="swap" />
              <Stack.Screen name="asset/[id]" />
              <Stack.Screen name="nft/[id]" />
              <Stack.Screen name="settings" />
            </Stack>

            {/* AppKit Modal - Absolute positioned for Android/Expo Router compatibility */}
            <View style={{ position: 'absolute', height: '100%', width: '100%', pointerEvents: 'box-none' }}>
              <AppKit />
            </View>
          </QueryClientProvider>
        </WagmiProvider>
      </AppKitProvider>
    </SafeAreaProvider>
  );
}