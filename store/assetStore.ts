/**
 * Asset Store
 * Manages current asset state for navigation context
 */

import type { AssetDetail } from '@/services/walletService';
import { create } from 'zustand';

interface AssetState {
  currentAsset: AssetDetail | null;
  setCurrentAsset: (asset: AssetDetail | null) => void;
  clearCurrentAsset: () => void;
}

export const useAssetStore = create<AssetState>((set) => ({
  currentAsset: null,
  setCurrentAsset: (asset) => set({ currentAsset: asset }),
  clearCurrentAsset: () => set({ currentAsset: null }),
}));
