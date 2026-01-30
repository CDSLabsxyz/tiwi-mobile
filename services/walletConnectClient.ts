/**
 * WalletConnect Client
 * Low-level implementation using Universal Provider & Sign Client
 * Optimized for Headless Handshake in React Native
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import '@walletconnect/react-native-compat';
import UniversalProvider from "@walletconnect/universal-provider";
import { Linking } from 'react-native';
import { storage } from '../utils/appkitStorage';

// Project ID from Reown Dashboard
export const WALLETCONNECT_PROJECT_ID = 'bc29e183924433ef00ed4e54088f1d5f';

// Metadata for the TIWI dApp
export const METADATA = {
  name: 'Tiwi Protocol',
  description: 'The Super App for the Web3 Generation',
  url: 'https://app.tiwiprotocol.xyz',
  icons: ['https://tiwi-protocol.vercel.app/images/logo.svg'],
  redirect: {
    native: 'tiwimobileapp://',
    universal: 'https://app.tiwiprotocol.xyz',
  },
};

/**
 * OPTIONAL NAMESPACES (Industry Best Practice)
 * We keep requiredNamespaces empty to maximize compatibility.
 */
export const OPTIONAL_NAMESPACES = {
  eip155: {
    methods: [
      "eth_accounts",
      "eth_requestAccounts",
      "eth_sendRawTransaction",
      "eth_sign",
      "eth_signTransaction",
      "eth_signTypedData",
      "eth_signTypedData_v3",
      "eth_signTypedData_v4",
      "eth_sendTransaction",
      "personal_sign",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_getPermissions",
      "wallet_requestPermissions",
      "wallet_registerOnboarding",
      "wallet_watchAsset",
      "wallet_scanQRCode",
      "wallet_sendCalls",
      "wallet_getCallsStatus",
      "wallet_showCallsStatus",
      "wallet_getCapabilities",
    ],
    events: [
      "chainChanged",
      "accountsChanged",
      "message",
      "disconnect",
      "connect",
    ],
    chains: ['eip155:1', 'eip155:137', 'eip155:56', 'eip155:42161', 'eip155:10'],
  },
};

let provider: UniversalProvider | null = null;
let isInitializing = false;
let relayerConnected = false;
let statusListeners: ((connected: boolean) => void)[] = [];

/**
 * Check if the WalletConnect Relayer is currently connected
 */
export const isRelayerConnected = () => relayerConnected;

/**
 * Subscribe to Relayer status changes
 */
export const subscribeToRelayerStatus = (callback: (connected: boolean) => void) => {
  statusListeners.push(callback);
  return () => {
    statusListeners = statusListeners.filter(l => l !== callback);
  };
};

const notifyStatusListeners = (connected: boolean) => {
  relayerConnected = connected;
  statusListeners.forEach(l => l(connected));
};

/**
 * Initialize Universal Provider
 * Singleton pattern with safe re-initialization checks
 */
export const getProvider = async (): Promise<UniversalProvider> => {
  if ((global as any).walletConnectProvider) {
    provider = (global as any).walletConnectProvider;
    return provider!;
  }

  if (provider) return provider;

  if (isInitializing) {
    let attempts = 0;
    while (isInitializing && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      if ((global as any).walletConnectProvider) {
        provider = (global as any).walletConnectProvider;
        return provider!;
      }
      attempts++;
    }
  }

  if ((global as any).walletConnectProvider) {
    provider = (global as any).walletConnectProvider;
    return provider!;
  }

  isInitializing = true;
  try {
    console.log('TIWI Connect: Initializing UniversalProvider...');
    const newProvider = await UniversalProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: METADATA,
      relayUrl: 'wss://relay.walletconnect.com',
    });

    provider = newProvider;
    (global as any).walletConnectProvider = newProvider;

    // 1. Mandatory Cleanup: Clear ALL stale pairings on initialization (Keychain Fix)
    // This resolves "No matching key. keychain" errors by ensuring a clean start
    console.log('TIWI Connect: Purging all stale pairings on initialization...');
    const pairings = newProvider.client.core.pairing.getPairings();
    if (pairings.length > 0) {
      await Promise.all(
        pairings.map(pairing =>
          newProvider.client.core.pairing.disconnect({ topic: pairing.topic })
            .catch(() => {/* ignore cleanup errors */ })
        )
      );
    }

    // 2. Listen for relayer status
    newProvider.client.core.relayer.on('relayer_connect', (data: any) => {
      console.log("🚀 ~ getProvider ~ relayer_connect:", data)
      console.log('TIWI Relayer: Connected');
      notifyStatusListeners(true);
    });

    newProvider.client.core.relayer.on('relayer_disconnect', (data: any) => {
      console.log("🚀 ~ getProvider ~ relayer_disconnect:", data)
      console.log('TIWI Relayer: Disconnected');
      notifyStatusListeners(false);
    });

    // Check initial status
    relayerConnected = newProvider.client.core.relayer.connected;
    console.log("🚀 ~ getProvider ~ relayerConnected:", relayerConnected)

    return provider;
  } catch (error) {
    console.error('TIWI Connect: Initialization failed', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

/**
 * Cleanup stale sessions (Keychain Fix)
 * Complements the pairing cleanup in getProvider
 */
export const cleanupStaleState = async () => {
  try {
    const universalProvider = await getProvider();

    // Clear active sessions if any are lingering
    const sessions = universalProvider.client.session.getAll();
    if (sessions.length > 0) {
      console.log(`TIWI Cleanup: Found ${sessions.length} lingering sessions. Purging...`);
      await Promise.all(
        sessions.map(session =>
          universalProvider.disconnect().catch(() => {/* ignore */ })
        )
      );
    }

    console.log('TIWI Cleanup: Stale sessions cleared successfully');
  } catch (error) {
    console.error('TIWI Cleanup: Failed to purge sessions', error);
  }
};

/**
 * Initialize session on app startup
 */
export const initializeSession = async () => {
  try {
    const universalProvider = await getProvider();

    // Always perform a deep cleanup on cold start to prevent Keychain errors
    await cleanupStaleState();

    if (universalProvider.session) {
      console.log('TIWI Connect: Restored existing session');
      return universalProvider.session;
    }
  } catch (error) {
    console.warn('Failed to restore session:', error);
  }
  return null;
};

/**
 * Connect to a wallet using Headless Deep-linking
 */
/**
 * Connect to a wallet using Headless Deep-linking
 */
export const connectToWallet = async (
  wallet: any,
  callbacks?: { onDisplayUri?: (uri: string) => void }
): Promise<any> => {
  const universalProvider = await UniversalProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: METADATA,
      relayUrl: 'wss://relay.walletconnect.com',
      storage
    });
  console.log("🚀 ~ connectToWallet ~ universalProvider:", universalProvider)

  // 1. Cleanup stale sessions to prevent conflicts
  if (universalProvider.session) {
    try {
      console.log('TIWI Connect: Disconnecting stale session before new connection...');
      await universalProvider.disconnect();
    } catch (e) {
      console.warn('Ignore disconnect error during cleanup:', e);
    }
  }

  console.log("Passed session cleanup", universalProvider.session)

  // 2. Setup URI Handler (Deep Linking)
  // We use a one-time listener for the 'display_uri' event
  const onDisplayUri = async (uri: string) => {
    console.log('TIWI Handshake: URI received', uri);

    // Notify callback if provided (for UI display)
    if (callbacks?.onDisplayUri) {
      callbacks.onDisplayUri(uri);
    }

    const nativeScheme = wallet.mobile?.native;
    const universalLink = wallet.mobile?.universal;

    // Construct deep link
    let deepLink = uri;
    if (nativeScheme) {
      deepLink = `${nativeScheme}wc?uri=${encodeURIComponent(uri)}`;
    }

    try {
      if (nativeScheme) {
        const canOpen = await Linking.canOpenURL(nativeScheme);
        if (canOpen) {
          await Linking.openURL(deepLink);
          return;
        }
      }

      // Fallback strategies
      if (universalLink) {
        await Linking.openURL(`${universalLink}/wc?uri=${encodeURIComponent(uri)}`);
      } else {
        await Linking.openURL(uri);
      }
    } catch (err) {
      console.warn('Deep link failed, falling back to raw URI:', err);
      try {
        await Linking.openURL(uri);
      } catch (e) {
        console.error('All linking attempts failed:', e);
      }
    }
  };

  console.log("Passed URI handler setup, trying to get Uri")

  // Subscribe to URI event
  universalProvider.on('display_uri', onDisplayUri);
  console.log("Gotten uri and ready to move on")

  // 3. Trigger Connection Handshake with Retry Logic
  const session = await universalProvider.connect({
    optionalNamespaces: OPTIONAL_NAMESPACES,
  });

  return session
  const MAX_RETRIES = 3;
  let retryCount = 0;

  const performConnect = async (): Promise<any> => {
    try {
      console.log(`TIWI Handshake: Attempt ${retryCount + 1}/${MAX_RETRIES}...`);

      const session = await universalProvider.connect({
        namespaces: {},
        optionalNamespaces: OPTIONAL_NAMESPACES,
      });

      return session;
    } catch (err: any) {
      const isNetworkError = err.message?.includes('Failed to publish') ||
        err.message?.includes('context: core/publisher') ||
        err.message?.includes('timeout');

      // if (isNetworkError && retryCount < MAX_RETRIES - 1) {
      //   retryCount++;
      //   const delay = Math.pow(2, retryCount) * 1000;
      //   console.warn(`TIWI Handshake: Failed with network error. Retrying in ${delay}ms...`, err.message);
      //   await new Promise(resolve => setTimeout(resolve, delay));
      //   return performConnect();
      // }

      console.error('TIWI Connect: Handshake failed', err);
      throw err;
    }
  };

  try {
    const session = await performConnect();
    return session;
  } finally {
    // 4. Cleanup Listener
    // universalProvider.removeListener('display_uri', onDisplayUri);
  }
};

/**
 * Disconnect current session
 */
export const disconnectWallet = async () => {
  const universalProvider = await getProvider();
  if (universalProvider.session) {
    try {
      await universalProvider.disconnect();
      // Clear global state if needed
      provider = null;
      (global as any).walletConnectProvider = null;
    } catch (e) {
      console.error('Disconnect error', e);
    }
  }
};
