/**
 * Root Layout
 * Handles navigation structure, onboarding, and wallet connection guards
 * Integrated with Headless WalletConnect and Wagmi
 */

// 1. IMPORT POLYFILLS FIRST (CRITICAL)
import '@/utils/polyfills';

import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { appKit, wagmiAdapter } from '@/config/AppKitConfig';
import { useTokenPrefetch } from '@/hooks/useTokenPrefetch';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { AppKit, AppKitProvider } from '@reown/appkit-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WagmiProvider } from 'wagmi';

// Initialize TanStack Query Client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Custom component to sync AppKit state with legacy walletStore
import { useAccount } from 'wagmi';
function WalletStateSync() {
  const { address, isConnected, chainId, status } = useAccount();
  const { setConnection } = useWalletStore();

  useEffect(() => {
    // Only sync if Wagmi has finished its internal reconnection check
    if (status === 'reconnecting' || status === 'connecting') return;

    // Sync React Native AppKit state to legacy Zustand store
    if (isConnected && address) {
      setConnection({
        address,
        chainId,
        isConnected: true,
      });
    } else if (status === 'disconnected') {
      // Only clear if we are genuinely disconnected, not just loading
      setConnection({
        address: null,
        chainId: undefined,
        isConnected: false
      });
    }
  }, [isConnected, address, chainId, setConnection, status]);

  return null;
}

function AppContent() {
  // Prefetch tokens on app load - Now safely inside QueryClientProvider
  useTokenPrefetch();

  return (
    <>
      <WalletStateSync />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="security" />
        <Stack.Screen name="lock" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="send" />
        <Stack.Screen name="receive" />
        <Stack.Screen name="swap" />
        <Stack.Screen name="chatbot" />
        <Stack.Screen name="asset/[id]" />
        <Stack.Screen name="nft/[id]" />
        <Stack.Screen name="wallet/index" />
        <Stack.Screen name="wallet/create" />
        <Stack.Screen name="wallet/import" />
      </Stack> {/* Fix for Android Modal Issue */}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 9999, pointerEvents: 'box-none' }}>
        <AppKit />
      </View>
    </>
  );
}


export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [isAppInitialized, setIsAppInitialized] = useState(false);

  const { hasCompletedOnboarding, isLoading: isOnboardingLoading, checkOnboardingStatus } = useOnboardingStore();
  const { isConnected, address } = useWalletStore();
  const { isLocked, hasPasscode, isSetupComplete, lastActive, lockApp, updateLastActive, autoLockTimeout } = useSecurityStore();
  console.log("🚀 ~ RootLayout ~ State:", { isLocked, isConnected, address, hasPasscode, isSetupComplete })

  // 1. Initialize app state
  useEffect(() => {
    const init = async () => {
      try {
        await checkOnboardingStatus();
        // Wait for persisted stores to rehydrate
        await new Promise((resolve) => {
          const check = () => {
            if (useSecurityStore.persist.hasHydrated() && useWalletStore.persist.hasHydrated()) {
              resolve(true);
            } else {
              setTimeout(check, 50);
            }
          };
          check();
        });
      } catch (e) {
        console.error('Initialization error', e);
      } finally {
        setIsNavigationReady(true);
        // We keep isAppInitialized false until the guard useEffect run once and routes
      }
    };
    init();
  }, []);

  // 2. App State Listener (Session Management)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const now = Date.now();
        const diff = now - lastActive;

        if (diff > autoLockTimeout && hasPasscode) {
          lockApp();
        }
        updateLastActive();
      } else if (nextAppState === 'background') {
        updateLastActive();
      }
    });

    return () => subscription.remove();
  }, [lastActive, hasPasscode, lockApp, updateLastActive, autoLockTimeout]);

  // 3. Navigation Guard Logic
  useEffect(() => {
    if (isOnboardingLoading || !isNavigationReady) return;

    const segmentsArray = Array.from(segments);
    const inOnboarding = segmentsArray[0] === 'onboarding';
    const inWelcome = segmentsArray[0] === 'welcome';
    const inSecurity = segmentsArray[0] === 'security';
    const inLock = segmentsArray[0] === 'lock';
    const inWalletFlow = segmentsArray[0] === 'wallet';
    const isRoot = segmentsArray.length === 0;

    // Flow 1: First time onboarding
    if (!hasCompletedOnboarding) {
      if (!inOnboarding) {
        router.replace('/onboarding' as any);
      }
    }
    // Flow 2: Returning User - Locked (Highest priority for security)
    else if (hasPasscode && isLocked) {
      if (!inLock) {
        router.replace('/lock' as any);
      }
    }
    // Flow 3: Wallet Connection Check
    else if (!isConnected) {
      if (!inWelcome && !inOnboarding && !inWalletFlow) {
        router.replace('/welcome' as any);
      }
    }
    // Flow 4: Mandatory Security Setup
    else if (!isSetupComplete) {
      if (!inSecurity && !inWelcome) {
        router.replace('/security' as any);
      }
    }
    // Flow 5: Authorized Session
    else {
      if (inOnboarding || inWelcome || inSecurity || inLock || inWalletFlow || isRoot) {
        router.replace('/(tabs)' as any);
      }
    }

    const finalizeInit = async () => {
      await SplashScreen.hideAsync();
      // Only set initialized once we've decided where to go
      setTimeout(() => setIsAppInitialized(true), 500);
    };
    finalizeInit();
  }, [hasCompletedOnboarding, isConnected, isOnboardingLoading, isNavigationReady, segments, hasPasscode, isLocked, isSetupComplete]);

  return (
    <SafeAreaProvider>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <AppKitProvider instance={appKit}>
          <QueryClientProvider client={queryClient}>
            <AppContent />
            {!isAppInitialized && <LoadingOverlay />}
          </QueryClientProvider>
        </AppKitProvider>
      </WagmiProvider>
    </SafeAreaProvider>
  );
}