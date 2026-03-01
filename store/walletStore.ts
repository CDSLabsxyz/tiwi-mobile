import { apiClient } from '@/services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ChainType = 'EVM' | 'SOLANA';

export interface WalletGroup {
  id: string;
  name: string;
  type: 'mnemonic' | 'privateKey' | 'external';
  primaryChain: ChainType;
  addresses: {
    [key in ChainType]?: string;
  };
  source: string; // e.g., 'internal', 'imported', 'metamask', etc.
  walletIcon?: string;
  isBackupComplete?: boolean;
}

interface WalletState {
  // Currently Active Identity
  activeGroupId: string | null;
  activeAddress: string | null; // Primary address (usually EVM)
  activeChain: ChainType;

  // Storage for all wallet groups
  walletGroups: WalletGroup[];

  // Legacy/Compatibility fields (keep for now to avoid breaking existing UI)
  address: string | null;
  isConnected: boolean;
  name: string | null;
  chainId: string | null;

  // Actions
  setConnection: (details: {
    address: string | null;
    name?: string;
    chainId: number | undefined;
    isConnected: boolean;
    walletIcon?: string;
    source?: string;
    type?: 'mnemonic' | 'privateKey' | 'external';
  }) => void;

  addWalletGroup: (group: WalletGroup) => void;
  setActiveGroup: (groupId: string) => void;
  updateGroupName: (groupId: string, name: string) => void;
  removeWalletGroup: (groupId: string) => void;

  disconnect: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Global Modal Control
  isWalletModalVisible: boolean;
  setWalletModalVisible: (visible: boolean) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      activeGroupId: null,
      activeAddress: null,
      activeChain: 'EVM',
      walletGroups: [],

      // Keep legacy fields populated for UI compatibility
      address: null,
      name: 'Wallet 1',
      chainId: null,
      isConnected: false,

      setConnection: ({ address, name, chainId, isConnected, walletIcon, source, type }) => {
        const state = get();
        const finalName = name || 'Wallet 1';

        set({
          address, // legacy
          activeAddress: address,
          activeChain: 'EVM',
          name: finalName,
          chainId: chainId ? chainId.toString() : null,
          isConnected,
        });

        // If it's a new connection, create or update a WalletGroup
        if (address && isConnected) {
          const lowerAddr = address.toLowerCase();
          const exists = state.walletGroups.some(g =>
            Object.values(g.addresses).some(addr => addr?.toLowerCase() === lowerAddr)
          );

          if (!exists) {
            const newGroup: WalletGroup = {
              id: lowerAddr, // Use address as ID for stability
              name: finalName,
              type: type || 'external',
              primaryChain: 'EVM',
              addresses: { EVM: address },
              source: source || 'walletconnect',
              walletIcon: walletIcon
            };
            get().addWalletGroup(newGroup);
          }
        }
      },

      addWalletGroup: (newGroup) => {
        const state = get();

        // Robust duplicate check by address across all groups
        const primaryAddr = newGroup.addresses[newGroup.primaryChain];
        const lowerPrimaryAddr = primaryAddr?.toLowerCase();

        // 1. Check if this address already exists in ANY existing group
        const existingGroup = state.walletGroups.find(g =>
          Object.values(g.addresses).some(addr => addr?.toLowerCase() === lowerPrimaryAddr)
        );

        if (existingGroup) {
          // If it exists, switch to it and STOP. Don't add a new duplicate.
          get().setActiveGroup(existingGroup.id);
          return;
        }

        // 2. PRUNE EXISTING DUPLICATES (One-time cleanup for old buggy data)
        // Keep only unique addresses to clean up the user's current messy list
        const seenAddresses = new Set<string>();
        const uniqueGroups = state.walletGroups.filter(g => {
          const addr = g.addresses[g.primaryChain]?.toLowerCase();
          if (!addr || seenAddresses.has(addr)) return false;
          seenAddresses.add(addr);
          return true;
        });

        const updatedGroups = [
          ...uniqueGroups.filter(g => g.id !== newGroup.id),
          newGroup
        ];

        set({
          walletGroups: updatedGroups,
          activeGroupId: newGroup.id,
          activeAddress: primaryAddr || null,
          activeChain: newGroup.primaryChain,
          isConnected: true,
          // Legacy sync
          address: primaryAddr || null,
          name: newGroup.name
        });

        // Register the primary address with backend
        if (primaryAddr) {
          let apiSource = newGroup.source;
          if (apiSource === 'internal' || apiSource === 'imported') apiSource = 'local';
          apiClient.registerWallet(primaryAddr, apiSource);
        }
      },

      setActiveGroup: (groupId) => {
        const group = get().walletGroups.find(g => g.id === groupId);
        if (group) {
          const mainAddr = group.addresses[group.primaryChain] || null;
          set({
            activeGroupId: groupId,
            activeAddress: mainAddr,
            activeChain: group.primaryChain,
            // Legacy sync
            address: mainAddr,
            name: group.name,
            isConnected: true
          });
        }
      },

      updateGroupName: (groupId, newName) => {
        const updatedGroups = get().walletGroups.map(g =>
          g.id === groupId ? { ...g, name: newName } : g
        );
        set({ walletGroups: updatedGroups });
        if (get().activeGroupId === groupId) {
          set({ name: newName });
        }
      },

      removeWalletGroup: (groupId) => {
        const state = get();
        const updatedGroups = state.walletGroups.filter(g => g.id !== groupId);

        const isRemovingActive = state.activeGroupId === groupId;

        set({
          walletGroups: updatedGroups,
          ...(isRemovingActive ? {
            activeGroupId: null,
            activeAddress: null,
            address: null,
            isConnected: false,
            chainId: null
          } : {})
        });
      },

      disconnect: () => set({
        activeGroupId: null,
        activeAddress: null,
        address: null,
        chainId: null,
        isConnected: false,
        walletGroups: [],
      }),
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Global Modal Implementation
      isWalletModalVisible: false,
      setWalletModalVisible: (visible) => set({ isWalletModalVisible: visible }),
    }),
    {
      name: 'tiwi-wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: (state) => {
        return () => state?.setHasHydrated(true);
      }
    }
  )
);
