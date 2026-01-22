/**
 * Asset Store - tracks the current asset being viewed
 * Used to maintain asset context across navigation
 */

import { create } from "zustand";
import type { PortfolioItem, AssetDetail } from "@/services/walletService";

interface AssetState {
  currentAsset: PortfolioItem | AssetDetail | null;
  setCurrentAsset: (asset: PortfolioItem | AssetDetail | null) => void;
  clearCurrentAsset: () => void;
}

/**
 * Asset store - tracks current asset for detail views and swap pre-population
 */
export const useAssetStore = create<AssetState>((set) => ({
  currentAsset: null,
  setCurrentAsset: (asset) => set({ currentAsset: asset }),
  clearCurrentAsset: () => set({ currentAsset: null }),
}));


