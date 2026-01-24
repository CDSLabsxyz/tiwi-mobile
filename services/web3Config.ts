/**
 * Reown Web3 Configuration
 * Initializes AppKit and Wagmi adapters for the TIWI Protocol
 */

import { createAppKit } from '@reown/appkit-react-native';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';
import { arbitrum, base, mainnet, optimism, polygon, bsc, avalanche, hyperliquid, lisk } from 'wagmi/chains';
import '@walletconnect/react-native-compat';
import * as Clipboard from 'expo-clipboard';
import { storage } from '@/utils/appkitStorage';

// Project ID from Reown Dashboard
export const projectId = 'bc29e183924433ef00ed4e54088f1d5f';

// Define the networks we want to support
export const networks = [mainnet, polygon, arbitrum, base, optimism, bsc, avalanche, hyperliquid, lisk] as [any, ...any[]];

// 1. Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

// 2. Create AppKit Instance
export const appKit = createAppKit({
  projectId,
  networks,
  adapters: [wagmiAdapter],
  defaultNetwork: mainnet,
  storage,
  // themeMode: 'dark',
  metadata: {
    name: 'Tiwi Protocol',
    description: 'The Super App for the Web3 Generation',
    url: 'https://app.tiwiprotocol.xyz',
    icons: ['https://tiwi-protocol.vercel.app/images/logo.svg'],
    redirect: {
      native: 'tiwi://',
      universal: 'https://app.tiwiprotocol.xyz',
    },
  },
  // Provide clipboard client for copy-to-clipboard functionality
  clipboardClient: {
    setString: async (value: string) => {
      await Clipboard.setStringAsync(value);
    },
  },
  // Modern AppKit features enabled by default
  features: {

    // analytics: true,
    swaps: true,
    onramp: true,
  }
});
