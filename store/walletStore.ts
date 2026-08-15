import { defaultNetworkIdForChain, isNetworkOnChain, WALLET_NETWORKS } from '@/constants/walletNetworks';
import { api } from '@/lib/mobile/api-client';
import { deriveMultiChainAddressesFromMnemonic, getSecureMnemonic } from '@/services/walletCreationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ChainType = 'EVM' | 'SOLANA' | 'TRON' | 'TON' | 'COSMOS' | 'OSMOSIS' | 'SUI' | 'APTOS' | 'INJECTIVE' | 'BITCOIN' | 'STARKNET';

/**
 * Extra chains whose addresses we DERIVE for balance discovery / display only.
 * They are NOT part of ChainType (which drives on-device signing) - mirrors the
 * web app's split between its 27-entry `MultiChainAddresses` bag and its signing
 * chains. Re-encode chains (INJECTIVE, cosmos-family) reuse the EVM/Cosmos keys.
 */
export type ExtraAddressKey =
  | 'LITECOIN' | 'DOGECOIN' | 'BITCOINCASH'
  | 'STACKS' | 'POLKADOT'
  | 'THORCHAIN' | 'JUNO' | 'STRIDE' | 'DYDX' | 'KUJIRA' | 'SECRET'
  | 'CELESTIA' | 'ARCHWAY' | 'SAGA' | 'NEUTRON' | 'NIBIRU';

/** Every key that can appear in a wallet's `addresses` map. */
export type AddressKey = ChainType | ExtraAddressKey;

export interface WalletGroup {
  id: string;
  name: string;
  type: 'mnemonic' | 'privateKey' | 'external';
  primaryChain: ChainType;
  addresses: {
    [key in AddressKey]?: string;
  };
  source: string; // e.g., 'internal', 'imported', 'metamask', etc.
  walletIcon?: string;
  isBackupComplete?: boolean;
  /**
   * Which derivation revision produced `addresses`. Bumped when a chain's
   * derivation is corrected so existing wallets re-derive on next unlock
   * instead of keeping an address the signer can't reproduce.
   *   1 → original
   *   2 → TON moved from secp256k1 to ed25519 (the old TON address was
   *       unsignable: a 33-byte secp256k1 key fed to an ed25519 contract)
   */
  addressSchemaVersion?: number;
}

/** Current derivation revision - see `WalletGroup.addressSchemaVersion`. */
export const ADDRESS_SCHEMA_VERSION = 2;

interface WalletState {
  // Currently Active Identity
  activeGroupId: string | null;
  activeAddress: string | null; // Primary address (usually EVM)
  activeChain: ChainType;
  activeNetworkId: string | null; // Specific network (ETH, BSC, BASE, etc.)

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
  /**
   * @param addressKey overrides which `addresses` slot becomes `activeAddress`.
   * The Cosmos-family chains all sign as COSMOS but each has its own bech32
   * address, so selecting "Juno" must show juno1… while keeping the signing
   * chain COSMOS. Defaults to `chain`.
   */
  setActiveChain: (chain: ChainType, networkId?: string, addressKey?: AddressKey) => void;
  updateGroupName: (groupId: string, name: string) => void;
  /** Per-address nickname overrides for the address book. Rendered in place
   *  of the wallet group's name when present, scoped to a single chain
   *  address so renaming the SOL row doesn't disturb the TRON row. */
  addressNicknames: Record<string, string>;
  setAddressNickname: (address: string, name: string) => void;
  clearAddressNickname: (address: string) => void;
  markBackupComplete: (groupId: string) => void;
  removeWalletGroup: (groupId: string) => void;
  syncActiveGroupAddresses: () => Promise<void>;

  disconnect: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Persisted balance cache - shows instantly on app open
  cachedBalances: Record<string, { tokens: any[]; totalNetWorthUsd: string; portfolioChange: { amount: string; percent: string }; updatedAt: number }>;
  setCachedBalances: (key: string, data: { tokens: any[]; totalNetWorthUsd: string; portfolioChange: { amount: string; percent: string } }) => void;

  // Global Modal & UI Control
  isWalletModalVisible: boolean;
  setWalletModalVisible: (visible: boolean) => void;
  isBalanceHidden: boolean;
  toggleBalanceVisibility: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      activeGroupId: null,
      activeAddress: null,
      activeChain: 'EVM',
      activeNetworkId: null,
      walletGroups: [],

      // Persisted balance cache
      cachedBalances: {},
      setCachedBalances: (key, data) => {
        set(state => ({
          cachedBalances: {
            ...state.cachedBalances,
            [key]: { ...data, updatedAt: Date.now() },
          },
        }));
      },

      // Keep legacy fields populated for UI compatibility
      address: null,
      name: 'Wallet 1',
      chainId: null,
      isConnected: false,

      setConnection: ({ address, name, chainId, isConnected, walletIcon, source, type }) => {
        const state = get();
        const finalName = name || 'Wallet 1';

        // External connections are EVM; show the network they actually
        // connected on rather than whatever the previous wallet left behind.
        const connectedNetwork = chainId
          ? WALLET_NETWORKS.find(n => n.chain === 'EVM' && n.chainId === chainId)
          : undefined;

        set({
          address, // legacy
          activeAddress: address,
          activeChain: 'EVM',
          activeNetworkId: connectedNetwork?.id ?? defaultNetworkIdForChain('EVM'),
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
          // A group created right now used the current derivation, so stamp it
          // - otherwise the migration below would pointlessly re-derive it.
          { ...newGroup, addressSchemaVersion: newGroup.addressSchemaVersion ?? ADDRESS_SCHEMA_VERSION },
        ];

        set({
          walletGroups: updatedGroups,
          activeGroupId: newGroup.id,
          activeAddress: primaryAddr || null,
          activeChain: newGroup.primaryChain,
          // Without this the freshly imported wallet inherits the previous
          // wallet's network id - a SOLANA import stamped 'ETH'.
          activeNetworkId: defaultNetworkIdForChain(newGroup.primaryChain, newGroup.addresses),
          isConnected: true,
          // Legacy sync
          address: primaryAddr || null,
          name: newGroup.name
        });

        // Register the primary address with backend (optional/background)
        if (primaryAddr) {
          let apiSource = newGroup.source;
          if (apiSource === 'internal' || apiSource === 'imported') apiSource = 'local';
          api.wallet.register(primaryAddr, apiSource).catch(err => {
             console.warn('[WalletStore] Failed to register wallet with backend:', err.message);
          });
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
            // Land on the wallet's OWN chain, not Ethereum. Hard-coding 'ETH'
            // here badged Solana/Cosmos/Tron imports as "ETH" and made the
            // dApp bridge announce chain id 1 for them.
            activeNetworkId: defaultNetworkIdForChain(group.primaryChain, group.addresses),
            // Legacy sync
            address: mainAddr,
            name: group.name,
            isConnected: true
          });
        }
      },

      setActiveChain: (chain, networkId, addressKey) => {
        const state = get();
        const activeGroup = state.walletGroups.find(g => g.id === state.activeGroupId);
        if (activeGroup) {
          const chainAddr = activeGroup.addresses[addressKey ?? chain] || null;
          set({
            activeChain: chain,
            activeNetworkId: networkId || null,
            activeAddress: chainAddr,
            // Sync legacy address selectively
            address: chainAddr || state.address
          });
        } else {
          set({ activeChain: chain, activeNetworkId: networkId || null });
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

      addressNicknames: {},
      setAddressNickname: (address, name) => {
        const key = address.toLowerCase();
        const trimmed = name.trim();
        const current = get().addressNicknames;
        if (!trimmed) {
          if (!(key in current)) return;
          const { [key]: _drop, ...rest } = current;
          set({ addressNicknames: rest });
          return;
        }
        set({ addressNicknames: { ...current, [key]: trimmed } });
      },
      clearAddressNickname: (address) => {
        const key = address.toLowerCase();
        const current = get().addressNicknames;
        if (!(key in current)) return;
        const { [key]: _drop, ...rest } = current;
        set({ addressNicknames: rest });
      },

      markBackupComplete: (groupId) => {
        const updatedGroups = get().walletGroups.map(g =>
          g.id === groupId ? { ...g, isBackupComplete: true } : g
        );
        set({ walletGroups: updatedGroups });
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

      syncActiveGroupAddresses: async () => {
        const state = get();
        const activeGroup = state.walletGroups.find(g => g.id === state.activeGroupId);
        if (!activeGroup || activeGroup.type !== 'mnemonic') return;

        // Chain-only phrase imports (a native 24-word TON mnemonic) are NOT
        // BIP39 and derive exactly one account. Running the multi-chain
        // derivation over one would mint junk addresses for every other chain
        // and - worse - overwrite the real TON address with a BIP39-path one.
        // A BIP39 wallet always has an EVM address; a chain-only one never does.
        if (!activeGroup.addresses.EVM) return;

        // Skip if all chain addresses (core 6 + extra) are already derived.
        // Existing wallets created before the extra chains were added get
        // backfilled to the full set on their next unlock.
        const allChains: AddressKey[] = [
            'EVM', 'SOLANA', 'TRON', 'TON', 'COSMOS', 'OSMOSIS',
            'INJECTIVE', 'BITCOIN', 'LITECOIN', 'DOGECOIN', 'BITCOINCASH',
            'STACKS', 'POLKADOT', 'SUI', 'APTOS', 'STARKNET',
            'THORCHAIN', 'JUNO', 'STRIDE', 'DYDX', 'KUJIRA', 'SECRET',
            'CELESTIA', 'ARCHWAY', 'SAGA', 'NEUTRON', 'NIBIRU',
        ];
        const missingChains = allChains.filter(c => !activeGroup.addresses[c]);
        // Wallets stamped with an older derivation revision re-derive even when
        // nothing is missing - a corrected chain (TON) must overwrite the stale
        // address, not be skipped because a value is present.
        const isStale = (activeGroup.addressSchemaVersion ?? 1) < ADDRESS_SCHEMA_VERSION;
        if (missingChains.length === 0 && !isStale) return;

        try {
          const mnemonic = await getSecureMnemonic(activeGroup.id);
          if (mnemonic) {
            const derived = await deriveMultiChainAddressesFromMnemonic(mnemonic);

            // Drop chains that failed to derive (each is individually caught and
            // returns undefined) - merging them would wipe a good address.
            const newAddresses = Object.fromEntries(
              Object.entries(derived).filter(([, v]) => !!v)
            ) as Partial<Record<AddressKey, string>>;

            // Only stamp the revision once the corrected chain actually derived,
            // so a transient library failure doesn't permanently skip the fix.
            const migrated = !!newAddresses.TON;

            // Merge new addresses into existing group
            const updatedGroups = get().walletGroups.map(g => {
              if (g.id === activeGroup.id) {
                return {
                  ...g,
                  addresses: { ...g.addresses, ...newAddresses },
                  ...(migrated ? { addressSchemaVersion: ADDRESS_SCHEMA_VERSION } : {}),
                };
              }
              return g;
            });

            set({ walletGroups: updatedGroups });

            // Refresh active address if it was null for the current chain
            const refreshedGroup = updatedGroups.find(g => g.id === activeGroup.id);
            if (refreshedGroup && refreshedGroup.addresses[state.activeChain]) {
               set({ activeAddress: refreshedGroup.addresses[state.activeChain] });
            }
          }
        } catch (error) {
          console.error('[WalletStore] Failed to sync addresses:', error);
        }
      },
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Global Modal & UI Implementation
      isWalletModalVisible: false,
      setWalletModalVisible: (visible) => set({ isWalletModalVisible: visible }),
      isBalanceHidden: false,
      toggleBalanceVisibility: () => set((state) => ({ isBalanceHidden: !state.isBalanceHidden })),
    }),
    {
      name: 'tiwi-wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => {
        return (hydrated) => {
          if (!hydrated) return;

          // Repair state persisted before `activeNetworkId` was kept on the
          // same chain as `activeChain` - existing installs already hold e.g.
          // { activeChain: 'SOLANA', activeNetworkId: 'ETH' } and would keep
          // rendering the wrong badge until the user switched networks.
          if (!isNetworkOnChain(hydrated.activeNetworkId, hydrated.activeChain)) {
            const group = hydrated.walletGroups.find(g => g.id === hydrated.activeGroupId);
            useWalletStore.setState({
              activeNetworkId: defaultNetworkIdForChain(hydrated.activeChain, group?.addresses),
            });
          }

          hydrated.setHasHydrated(true);
        };
      }
    }
  )
);
