/**
 * Wallet Store
 * Manages the connection state and sessions for the TIWI Protocol
 * Integrated with Wagmi/Reown for reactive state updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WalletState {
  // Session details from WalletConnect/Wagmi
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  
  // Actions
  setConnection: (details: { address: string | null; chainId: number | undefined; isConnected: boolean }) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      chainId: null,
      isConnected: false,

      setConnection: ({ address, chainId, isConnected }) => set({ 
        address,
        chainId: chainId ? chainId.toString() : null,
        isConnected 
      }),

      disconnect: () => set({ 
        address: null, 
        chainId: null, 
        isConnected: false 
      }),
    }),
    {
      name: 'tiwi-wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
