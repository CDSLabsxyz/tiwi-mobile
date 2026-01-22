/**
 * Global UI state store
 * Manages UI state shared across multiple screens (modals, loading states, etc.)
 */

import { create } from "zustand";

interface UIState {
  // Wallet modal state (used across home, swap, and other screens)
  isWalletModalVisible: boolean;
  
  // Actions
  openWalletModal: () => void;
  closeWalletModal: () => void;
}

/**
 * Global UI store for shared UI state
 */
export const useUIStore = create<UIState>((set) => ({
  // Initial state
  isWalletModalVisible: false,
  
  // Actions
  openWalletModal: () => set({ isWalletModalVisible: true }),
  closeWalletModal: () => set({ isWalletModalVisible: false }),
}));

