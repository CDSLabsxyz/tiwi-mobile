# Wallet Connection Integration Plan

This plan details the steps to clean up the `connectToWallet` function, implement proper redirection logic, and handle existing sessions.

## Goals
1.  **Clean Code**: Refactor `walletConnectClient.ts` to remove commented-out code and ensure robust `UniversalProvider` initialization.
2.  **Reliable Handshake**: Fix the deep-linking and session approval flow.
3.  **Smart Redirection**: Automatically redirect users based on their state (Onboarding -> Welcome -> Home).
4.  **Session Restoration**: Handle cases where the user is already connected.

## Step 1: Clean Up `services/walletConnectClient.ts`
The current file contains legacy code and inconsistent provider initialization. We will rewrite it to be a clean singleton.

### Changes
-   Remove unused variables and commented blocks.
-   Ensure `UniversalProvider.init` is only called when necessary.
-   Fix the "display_uri" event handling to properly trigger deep links.
-   Return the session object consistently.

## Step 2: enhance `hooks/useTiwiConnect.ts`
Refactor the hook to handle the "already connected" state and manage navigation post-connection.

### Changes
-   Check `useWalletStore.isConnected` before initiating a new connection.
-   If connected, auto-redirect to `(tabs)/home` (or passcode if applicable).
-   After a successful new connection, call `completeOnboarding()` and then redirect.

## Step 3: Implement Navigation Guards in `app/_layout.tsx`
Enable the router guards to protect access to the app.

### Logic
1.  **Onboarding Guard**: If `!hasCompletedOnboarding`, force to `/onboarding`.
2.  **Connection Guard**: If `!isConnected`, force to `/welcome`.
3.  **Auth Guard**: If authenticated, prevent access to `/onboarding` or `/welcome` and redirect to `(tabs)/home`.

## Implementation Details

### A. `services/walletConnectClient.ts` Refactor
```typescript
import '@walletconnect/react-native-compat';
import UniversalProvider from "@walletconnect/universal-provider";
import { Linking } from 'react-native';

export const WALLETCONNECT_PROJECT_ID = 'bc29e183924433ef00ed4e54088f1d5f';

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

export const OPTIONAL_NAMESPACES = {
  eip155: {
    methods: [
      "eth_accounts", "eth_requestAccounts", "eth_sendRawTransaction", "eth_sign",
      "eth_signTransaction", "eth_signTypedData", "eth_signTypedData_v3",
      "eth_signTypedData_v4", "personal_sign", "wallet_switchEthereumChain",
      "wallet_addEthereumChain"
    ],
    events: ["chainChanged", "accountsChanged", "display_uri", "disconnect", "connect"],
    chains: ['eip155:1', 'eip155:137', 'eip155:56', 'eip155:42161', 'eip155:10'],
  },
};

let provider: UniversalProvider | null = null;

export const getProvider = async (): Promise<UniversalProvider> => {
  if (provider) return provider;

  provider = await UniversalProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    metadata: METADATA,
    relayUrl: 'wss://relay.walletconnect.com',
  });
  return provider;
};

export const initializeSession = async () => {
  const universalProvider = await getProvider();
  if (universalProvider.session) {
    return universalProvider.session;
  }
  return null;
};

export const connectToWallet = async (wallet: any): Promise<any> => {
  const universalProvider = await getProvider();

  // Cleanup old session if it exists but isn't valid
  if (universalProvider.session) {
    try {
      await universalProvider.disconnect();
    } catch (e) {
        console.warn('Cleanup error', e);
    }
  }

  // Setup URI handling
  const handleUri = async (uri: string) => {
      const nativeScheme = wallet.mobile?.native;
      const universalLink = wallet.mobile?.universal;
      const deepLink = nativeScheme ? `${nativeScheme}wc?uri=${encodeURIComponent(uri)}` : uri;
      
      try {
          await Linking.openURL(deepLink);
      } catch (err) {
          // Fallback
          if (universalLink) {
             await Linking.openURL(`${universalLink}/wc?uri=${encodeURIComponent(uri)}`);
          } else {
             await Linking.openURL(uri);
          }
      }
  };

  // Listen for the URI event *once*
  universalProvider.once('display_uri', handleUri);

  try {
    const session = await universalProvider.connect({
      namespaces: {},
      optionalNamespaces: OPTIONAL_NAMESPACES,
    });
    return session;
  } catch (error) {
    throw error;
  } finally {
      // Clean up listener if connect fails or finishes without firing (rare)
      universalProvider.removeListener('display_uri', handleUri);
  }
};

export const disconnectWallet = async () => {
  const universalProvider = await getProvider();
  if (universalProvider.session) {
    await universalProvider.disconnect();
  }
};
```

### B. `hooks/useTiwiConnect.ts` Update
```typescript
import { connectToWallet } from '@/services/walletConnectClient';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

export const useTiwiConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { setConnection, isConnected } = useWalletStore();
  const { completeOnboarding } = useOnboardingStore();
  const router = useRouter();

  const connect = useCallback(async (wallet: any) => {
    // 0. Check if already connected
    if (isConnected) {
        router.replace('/(tabs)/earn'); // Or Home
        return;
    }

    setIsConnecting(true);
    try {
      const session = await connectToWallet(wallet);

      if (session) {
        let address = '';
        let chainId = 1;

        const eip155Namespace = session.namespaces?.eip155;
        if (eip155Namespace && eip155Namespace.accounts.length > 0) {
          const fullAddress = eip155Namespace.accounts[0]; 
          address = fullAddress.split(':')[2];
          chainId = parseInt(fullAddress.split(':')[1]);
        } 
        else if (session.namespaces?.solana?.accounts.length > 0) {
          const fullAddress = session.namespaces.solana.accounts[0];
          address = fullAddress.split(':')[2];
          chainId = 101; 
        }

        if (address) {
          setConnection({
            address,
            chainId,
            isConnected: true,
          });

          await completeOnboarding();
          
          // Redirect to Home (or Passcode if implemented)
          router.replace('/(tabs)/earn');
        }
      }
    } catch (error) {
      console.error('TIWI Connect Error:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [setConnection, completeOnboarding, isConnected, router]);

  return { connect, isConnecting };
};
```
