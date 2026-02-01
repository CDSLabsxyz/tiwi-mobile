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
import { currencyService } from '@/services/currencyService';
import { deviceService } from '@/services/deviceService';
import { mobileSessionManager } from '@/services/mobileSessionManager';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { AppKit, AppKitProvider } from '@reown/appkit-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WagmiProvider } from 'wagmi';

import { BlurView } from 'expo-blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const AUTO_LOCK_TIMEOUT = 1000 * 60 * 5; // 5 Minutes

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
  const { address, isConnected, chainId } = useAccount();
  const { setConnection } = useWalletStore();

  useEffect(() => {
    // Sync React Native AppKit state to legacy Zustand store
    if (isConnected && address) {
      setConnection({
        address,
        chainId,
        isConnected: true,
        // Optional: Could fetch wallet metadata/icon if available from hook
      });
    } else if (!isConnected) {
      setConnection({
        address: null,
        chainId: undefined,
        isConnected: false
      });
    }
  }, [isConnected, address, chainId, setConnection]);

  return null;
}

function SecurityOverlay() {
  const { hasPasscode } = useSecurityStore();
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  // Only show blur when app is not active (Privacy in App Switcher)
  // When active, the Lock screen handles protection without needing an overlay.
  const shouldShowOverlay = appState !== 'active' && hasPasscode;

  if (!shouldShowOverlay) return null;

  return (
    <View
      style={{ ...StyleSheet.absoluteFillObject, zIndex: 99999 }}
      pointerEvents="none"
    >
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  );
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
      <SecurityOverlay />
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
        await currencyService.init(); // Initialize currency service
        // Register current device session
        await deviceService.registerSession();
      } catch (e) {
        console.error('Initialization error', e);
      } finally {
        setIsNavigationReady(true);
        setIsAppInitialized(true);
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
        // Update device session last active (Local + Cloud)
        if (isConnected && address) {
          mobileSessionManager.syncCurrentSession(address);
        } else {
          deviceService.registerSession();
        }
      } else if (nextAppState === 'background') {
        // Immediately update last active when going to background
        updateLastActive();
        if (isConnected && address) {
          mobileSessionManager.syncCurrentSession(address);
        } else {
          deviceService.registerSession();
        }

        // If timeout is set to 0 (Immediately), lock now
        if (autoLockTimeout === 0 && hasPasscode) {
          lockApp();
        }
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
    // Flow 2: Connect Wallet (Returning or New)
    else if (!isConnected) {
      if (!inWelcome && !inOnboarding && !inWalletFlow) {
        router.replace('/welcome' as any);
      }
    }
    // Flow 3: Returning User - Locked
    else if (isLocked && hasPasscode) {
      if (!inLock) {
        router.replace('/lock' as any);
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

    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, [hasCompletedOnboarding, isConnected, isOnboardingLoading, isNavigationReady, segments, hasPasscode, isLocked, isSetupComplete]);

  // 4. Cloud Session Sync & Kill Switch
  useEffect(() => {
    if (!isConnected || !address) return;

    let subscription: any = null;

    const setupSession = async () => {
      // Sync with cloud
      await mobileSessionManager.syncCurrentSession(address);

      // Subscribe to remote termination
      const deviceId = await deviceService.getOrCreateDeviceId();
      subscription = mobileSessionManager.subscribeToKillSwitch(
        address,
        deviceId,
        () => {
          // Emergency Logout Action
          const { setConnection } = useWalletStore.getState();
          const { lockApp } = useSecurityStore.getState();

          setConnection({
            address: null,
            isConnected: false,
            chainId: undefined
          });
          lockApp();
          router.replace('/welcome' as any);
        }
      );
    };

    setupSession();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [isConnected, address]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}