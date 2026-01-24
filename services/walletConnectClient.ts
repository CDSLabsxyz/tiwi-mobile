/**
 * WalletConnect Client Service
 * Handles dApp connection requests to external wallets
 */

import { useWalletStore } from '@/store/walletStore';
import SignClient from '@walletconnect/sign-client';
import { Linking, Platform } from 'react-native';

const PROJECT_ID = '8e998cd112127e42dce5e2bf74122539';

let signClient: SignClient | null = null;

export const initSignClient = async () => {
  if (signClient) return signClient;

  signClient = await SignClient.init({
    projectId: PROJECT_ID,
    metadata: {
      name: 'Tiwi Protocol',
      description: 'The Super App for the Web3 Generation',
      url: 'https://app.tiwiprotocol.xyz',
      icons: ['https://tiwi-protocol.vercel.app/images/logo.svg'], // Placeholder
      redirect: {
        native: 'tiwi://', // Our app scheme
      },
    },
  });

  // Listen for session deletion (disconnect from wallet side)
  signClient.on('session_delete', () => {
    useWalletStore.getState().disconnect();
  });

  // Listen for session expiry
  signClient.on('session_expire', () => {
    useWalletStore.getState().disconnect();
  });

  return signClient;
};

/**
 * Initiates a connection with a wallet
 * @param walletMetadata Metadata including deep link schemes and store URLs
 */
export const connectWallet = async (walletMetadata?: {
  native?: string;
  universal?: string;
  ios?: string;
  android?: string;
}) => {
  const client = await initSignClient();

  try {
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        eip155: {
          methods: [
            'eth_sendTransaction',
            'personal_sign',
            'eth_signTypedData',
          ],
          chains: ['eip155:1'], // Ethereum Mainnet
          events: ['chainChanged', 'accountsChanged'],
        },
      },
    });

    if (uri) {
      const encodedUri = encodeURIComponent(uri);
      
      // If we have a specific native scheme
      if (walletMetadata?.native) {
        // Industry best practice: Check if the app is installed first
        const canOpen = await Linking.canOpenURL(walletMetadata.native);
        
        if (canOpen) {
          // App is installed, open it with WC URI
          const url = `${walletMetadata.native}wc?uri=${encodedUri}`;
          await Linking.openURL(url);
        } else {
          // App not installed, redirect to store
          // Use platform-specific store URL
          const storeUrl = Platform.OS === 'ios' ? walletMetadata.ios : walletMetadata.android;
          if (storeUrl) {
            await Linking.openURL(storeUrl);
          } else {
            // Fallback to universal link if store URL missing
            if (walletMetadata.universal) {
                await Linking.openURL(`${walletMetadata.universal}/wc?uri=${encodedUri}`);
            } else {
                // Secondary fallback to generic WalletConnect
                await Linking.openURL(`wc://wc?uri=${encodedUri}`);
            }
          }
        }
      } else {
        // Generic WalletConnect flow (QR code or generic scheme)
        await Linking.openURL(`wc://wc?uri=${encodedUri}`);
      }
    }

    // Await approval
    const session = await approval();
    
    // Save to store
    const address = session.namespaces.eip155.accounts[0].split(':')[2];
    const chainId = session.namespaces.eip155.accounts[0].split(':')[1];
    
    useWalletStore.getState().setSession(session);
    useWalletStore.getState().setAddress(address);
    useWalletStore.getState().setChainId(chainId);

    return session;
  } catch (error) {
    if (error instanceof Error && error.message === 'Connection rejected') {
        // User closed the wallet or cancelled
        return null;
    }
    console.error('Connection failed:', error);
    throw error;
  }
};

export const getSignClient = () => {
  if (!signClient) {
    throw new Error('SignClient not initialized. Call initSignClient first.');
  }
  return signClient;
};
