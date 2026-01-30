import { connectToWallet } from '@/services/walletConnectClient';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSecurityStore } from '@/store/securityStore';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

export const useTiwiConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionUri, setConnectionUri] = useState<string | null>(null);
  const { setConnection, isConnected } = useWalletStore();
  const { completeOnboarding } = useOnboardingStore();
  const router = useRouter();

  const connect = useCallback(async (wallet: any, callbacks?: { onSuccess?: () => void }) => {
    if (isConnected) {
      console.log('TIWI Connect: Already connected. Redirecting...');
      await completeOnboarding();
      const hasPasscode = useSecurityStore.getState().hasPasscode;
      if (!hasPasscode) {
        router.replace('/security' as any);
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    setIsConnecting(true);
    setConnectionUri(null); // Reset URI

    try {
      console.log('TIWI Connect: Initiating headless connection for', wallet.name);

      // Pass onDisplayUri callback to capture the raw URI
      const session = await connectToWallet(wallet, {
        onDisplayUri: (uri) => {
          setConnectionUri(uri);
        }
      });

      console.log("🚀 ~ useTiwiConnect ~ session:", session)
      if (session) {
        // ... (Session handling logic mostly same as before, just ensuring we clean up UI)
        let address = '';
        let chainId = 1;

        const eip155Namespace = session.namespaces?.eip155;
        if (eip155Namespace && eip155Namespace.accounts.length > 0) {
          const fullAddress = eip155Namespace.accounts[0];
          const parts = fullAddress.split(':');
          if (parts.length >= 3) {
            address = parts[2];
            chainId = parseInt(parts[1], 10);
          } else {
            address = fullAddress;
          }
        } else if (session.namespaces?.solana?.accounts.length > 0) {
          const fullAddress = session.namespaces.solana.accounts[0];
          const parts = fullAddress.split(':');
          if (parts.length >= 3) {
            address = parts[2];
            chainId = 101;
          }
        }

        const walletIcon = session.peer?.metadata?.icons?.[0];

        if (address) {
          setConnection({
            address,
            chainId,
            isConnected: true,
            walletIcon: walletIcon,
          });

          await completeOnboarding();

          if (callbacks?.onSuccess) {
            callbacks.onSuccess();
          } else {
            router.replace('/(tabs)');
          }
        }
      }
    } catch (error) {
      console.error('TIWI Connect Error:', error);
    } finally {
      setIsConnecting(false);
      setConnectionUri(null);
    }
  }, [setConnection, completeOnboarding, isConnected, router]);

  const cancelConnection = useCallback(async () => {
    // Abort logic: We rely on disconnectWallet which disconnects current session/pairing
    // In a real abort scenario we might need to target the specific pairing, but disconnectWallet is a safe cleanup
    try {
      const { disconnectWallet } = require('@/services/walletConnectClient');
      await disconnectWallet();
      setIsConnecting(false);
      setConnectionUri(null);
    } catch (e) {
      console.error("Cancel failed", e);
    }
  }, []);

  return {
    connect,
    isConnecting,
    connectionUri,
    cancelConnection
  };
};
