import { apiClient } from '@/services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ChainType = 'evm' | 'solana' | 'bitcoin' | 'other';

export interface ConnectedWallet {
  address: string;
  name: string;
  chainType: ChainType;
  source: string;
  isConnected: boolean;
  walletIcon?: string;
}

interface WalletState {
  // Legacy / Active session
  address: string | null;
  name: string | null;
  chainId: string | null;
  isConnected: boolean;

  // Multi-wallet state
  connectedWallets: ConnectedWallet[];
  walletIcon: string | null;
  // Actions
  setConnection: (details: {
    address: string | null;
    name?: string;
    chainId: number | undefined;
    isConnected: boolean;
    walletIcon?: string;
    source?: string;
  }) => void;
  updateWalletName: (name: string) => void;
  addWallet: (wallet: Omit<ConnectedWallet, 'isConnected'>) => Promise<void>;
  removeWallet: (address: string) => void;
  setActiveWallet: (address: string) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      name: 'Wallet 1',
      chainId: null,
      isConnected: false,

      connectedWallets: [],
      walletIcon: null,

      setConnection: ({ address, name, chainId, isConnected, walletIcon, source }) => {
        const state = get();
        const finalName = name || 'Wallet 1';

        set({
          address,
          name: finalName,
          chainId: chainId ? chainId.toString() : null,
          isConnected,
          walletIcon: walletIcon || null
        });

        // Automatically add to connected wallets if not present
        if (address && isConnected) {
          const exists = state.connectedWallets.some(w => w.address.toLowerCase() === address.toLowerCase());
          if (!exists) {
            get().addWallet({
              address,
              name: finalName,
              chainType: address.startsWith('0x') ? 'evm' : 'solana',
              source: source || 'walletconnect',
              walletIcon: walletIcon
            });
          }
        }
      },

      updateWalletName: (newName) => {
        const state = get();
        if (state.address) {
          set({ name: newName });
          const updatedWallets = state.connectedWallets.map(w =>
            w.address === state.address ? { ...w, name: newName } : w
          );
          set({ connectedWallets: updatedWallets });
        }
      },

      addWallet: async (newWallet) => {
        const state = get();
        const updatedWallets = [
          ...state.connectedWallets.filter(w => w.address.toLowerCase() !== newWallet.address.toLowerCase()),
          { ...newWallet, isConnected: true }
        ];

        set({ connectedWallets: updatedWallets });

        // Map internal sources to API allowed sources
        let apiSource = newWallet.source;
        const ALLOWED_SOURCES = ['local', 'metamask', 'walletconnect', 'coinbase', 'rabby', 'phantom', 'other'];

        if (apiSource === 'internal' || apiSource === 'imported') {
          apiSource = 'local';
        } else if (!ALLOWED_SOURCES.includes(apiSource)) {
          apiSource = 'other';
        }

        // Register with backend in background
        apiClient.registerWallet(newWallet.address, apiSource);

        // queryClient will automatically refetch due to connectedWallets dependency
      },

      removeWallet: (address) => {
        const state = get();
        const updatedWallets = state.connectedWallets.filter(w => w.address !== address);

        set({
          connectedWallets: updatedWallets,
          // If removing active wallet, clear it
          ...(state.address === address ? { address: null, isConnected: false, chainId: null } : {})
        });
      },

      setActiveWallet: (address) => {
        const wallet = get().connectedWallets.find(w => w.address === address);
        if (wallet) {
          set({
            address: wallet.address,
            name: wallet.name,
            isConnected: true,
            // Chain ID might be unknown or need updating from provider
          });
        }
      },

      disconnect: () => set({
        address: null,
        chainId: null,
        isConnected: false,
        connectedWallets: [],
        walletIcon: null,
      }),
    }),
    {
      name: 'tiwi-wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
