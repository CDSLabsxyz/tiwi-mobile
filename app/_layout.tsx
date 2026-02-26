/**
 * Root Layout
 * Handles navigation structure, onboarding, and wallet connection guards
 * Integrated with Headless WalletConnect and Wagmi
 */

// 1. IMPORT POLYFILLS FIRST (CRITICAL)
import '@/utils/polyfills';

import { TransactionToast } from '@/components/ui/TransactionToast';
import { appKit, wagmiAdapter } from '@/config/AppKitConfig';
import { useTokenPrefetch } from '@/hooks/useTokenPrefetch';
import { currencyService } from '@/services/currencyService';
import { deviceService } from '@/services/deviceService';
import { mobileSessionManager } from '@/services/mobileSessionManager';
import { initializeLiFi } from '@/services/swap/lifiConfig';
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
// SplashScreen.preventAutoHideAsync();

// Custom component to sync AppKit state with legacy walletStore
import { useAccount } from 'wagmi';
function WalletStateSync() {
  const { address, isConnected, chainId } = useAccount();
  const { setConnection } = useWalletStore();

  useEffect(() => {
    // Only sync if we have a definitive connection.
    // We let the navigation guard and setup flags handle the logic 
    // for whether the user should be in the app or not.
    if (isConnected && address) {
      setConnection({
        address,
        chainId,
        isConnected: true,
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
  // Prefetch tokens on app load
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
      </Stack>
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
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  // const [isMounted, setIsMounted] = useState(false);

  // useEffect(() => {
  //   setIsMounted(true);
  // }, []);

  const { hasCompletedOnboarding, isLoading: isOnboardingLoading, checkOnboardingStatus } = useOnboardingStore();
  const { isConnected, address, _hasHydrated: isWalletHydrated } = useWalletStore();
  const {
    isLocked,
    hasPasscode,
    isSetupComplete,
    setupPhase,
    lastActive,
    lockApp,
    updateLastActive,
    autoLockTimeout,
    _hasHydrated: isSecurityHydrated,
    resetSecurity
  } = useSecurityStore();

  const isHydrated = isWalletHydrated && isSecurityHydrated;
  const isReadyForApp = isAppInitialized && isHydrated && isNavigationReady;

  SplashScreen.setOptions({
    duration: 1000,
    fade: true,
  });


  // 1. Initialize app state
  useEffect(() => {
    const init = async () => {
      try {
        SplashScreen.preventAutoHideAsync()
        // await AsyncStorage.clear();
        // await resetSecurity()
        await Promise.all([
          checkOnboardingStatus(),
          currencyService.init(),
          deviceService.registerSession(),
          initializeLiFi()
        ]);
      } catch (e) {
        console.error('Initialization error', e);
      } finally {
        setIsNavigationReady(true);
        setIsAppInitialized(true);
        // Hide native splash once our animated splash is ready to take over
        SplashScreen.hideAsync();
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
        if (isConnected && address) {
          mobileSessionManager.syncCurrentSession(address);
        } else {
          deviceService.registerSession();
        }
      } else if (nextAppState === 'background') {
        updateLastActive();
        if (isConnected && address) {
          mobileSessionManager.syncCurrentSession(address);
        } else {
          deviceService.registerSession();
        }

        if (autoLockTimeout === 0 && hasPasscode) {
          lockApp();
        }
      }
    });

    return () => subscription.remove();
  }, [lastActive, hasPasscode, lockApp, updateLastActive, autoLockTimeout, isConnected, address]);

  // 3. Navigation Guard Logic
  useEffect(() => {
    // if (!isMounted || isOnboardingLoading || !isNavigationReady || !isHydrated) return;
    if (isOnboardingLoading || !isNavigationReady || !isHydrated) return;

    const segmentsArray = Array.from(segments);
    const firstSegment = segmentsArray[0];

    const inOnboarding = firstSegment === 'onboarding';
    const inWelcome = firstSegment === 'welcome';
    const inSecurity = firstSegment === 'security';
    const inLock = firstSegment === 'lock';
    const inWalletFlow = firstSegment === 'wallet';
    const isRoot = segmentsArray.length === 0;

    // Step 1: Handle Carousel Onboarding
    if (!hasCompletedOnboarding) {
      if (!inOnboarding) router.replace('/onboarding' as any);
      return;
    }

    // Step 2: Handle Setup Phases
    switch (setupPhase) {
      case 'WELCOME':
        if (!inWelcome && !inWalletFlow) {
          router.replace('/welcome' as any);
        }
        break;

      case 'WALLET_READY':
        // User has wallet but no security. Force security setup.
        if (!inSecurity) {
          router.replace('/security' as any);
        }
        break;

      case 'SECURITY_READY':
        // User has passcode but hasn't finished notifications/final step.
        // Depending on the app flow, we might want to let them continue 
        // but let's see where they are.
        if (!inSecurity && !inLock && !firstSegment?.includes('(tabs)')) {
          // If they are not in security and not in tabs, send them back to finish
          router.replace('/security/biometrics' as any); // Or wherever you want them to resume
        }
        break;

      case 'COMPLETED':
        // Standard app entry
        if (isLocked) {
          if (!inLock) router.replace('/lock' as any);
          return;
        }

        // If they are in setup screens but completed, move to tabs
        if (inOnboarding || inWelcome || inSecurity || inLock || isRoot) {
          router.replace('/(tabs)' as any);
        }
        break;
    }
  }, [hasCompletedOnboarding, isConnected, isOnboardingLoading, isNavigationReady, segments, hasPasscode, isLocked, isSetupComplete, setupPhase, isHydrated]);

  // 4. Cloud Session Sync & Kill Switch
  useEffect(() => {
    if (!isConnected || !address) return;

    let subscription: any = null;

    const setupSession = async () => {
      await mobileSessionManager.syncCurrentSession(address);
      const deviceId = await deviceService.getOrCreateDeviceId();
      subscription = mobileSessionManager.subscribeToKillSwitch(
        address,
        deviceId,
        () => {
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
      if (subscription) subscription.unsubscribe();
    };
  }, [isConnected, address]);
  const { address: activeAddress, activeChain, walletGroups, } = useWalletStore();
  // console.log("🚀 ~ RootLayout ~ :", { activeAddress, hasCompletedOnboarding, isConnected, isOnboardingLoading, isNavigationReady, segments, hasPasscode, isLocked, isSetupComplete, setupPhase, isHydrated, activeChain, walletGroups: walletGroups, })


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
          <AppKitProvider instance={appKit}>
            <QueryClientProvider client={queryClient}>
              <AppContent />
              <TransactionToast />
              {/* {!isSplashComplete && (
                <AnimatedSplashScreen
                  isReady={isReadyForApp}
                  onAnimationComplete={() => setIsSplashComplete(true)}
                />
              )} */}
            </QueryClientProvider>
          </AppKitProvider>
        </WagmiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}