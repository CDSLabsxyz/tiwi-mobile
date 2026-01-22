/**
 * Filter Store - manages asset filtering state
 * Production-ready filter management for wallet assets
 */

import { create } from "zustand";

export type SortOption = "highest-value" | "recent-activity" | null;
export type TokenCategory = "defi" | "meme" | "gaming" | "new-listings";
export type ChainFilter = "bsc" | "ethereum" | "polygon" | "solana";

interface FilterState {
  // Sort options (radio - only one can be selected)
  sortBy: SortOption;

  // Token categories (checkboxes - multiple can be selected)
  tokenCategories: Set<TokenCategory>;

  // Chain filters (checkboxes - multiple can be selected)
  chains: Set<ChainFilter>;

  // Actions
  setSortBy: (sort: SortOption) => void;
  toggleTokenCategory: (category: TokenCategory) => void;
  toggleChain: (chain: ChainFilter) => void;
  resetFilters: () => void;
  trackFilterChange: () => void;

  // Computed
  hasActiveFilters: () => boolean;
}

/**
 * Filter store - manages all filter state for wallet assets
 */
export const useFilterStore = create<FilterState>((set, get) => ({
  // Initial state
  sortBy: null,
  tokenCategories: new Set<TokenCategory>(),
  chains: new Set<ChainFilter>(),

  // Actions
  setSortBy: (sort) => {
    set({ sortBy: sort });
    // Track filter selection
    get().trackFilterChange();
  },

  toggleTokenCategory: (category) => {
    const current = get().tokenCategories;
    const updated = new Set(current);
    
    if (updated.has(category)) {
      updated.delete(category);
    } else {
      updated.add(category);
    }
    
    set({ tokenCategories: updated });
    get().trackFilterChange();
  },

  toggleChain: (chain) => {
    const current = get().chains;
    const updated = new Set(current);
    
    if (updated.has(chain)) {
      updated.delete(chain);
    } else {
      updated.add(chain);
    }
    
    set({ chains: updated });
    get().trackFilterChange();
  },

  resetFilters: () => {
    set({
      sortBy: null,
      tokenCategories: new Set<TokenCategory>(),
      chains: new Set<ChainFilter>(),
    });
    get().trackFilterChange();
  },

  // Track filter changes (for analytics/API)
  trackFilterChange: () => {
    const state = get();
    const filterData = {
      sortBy: state.sortBy,
      tokenCategories: Array.from(state.tokenCategories),
      chains: Array.from(state.chains),
      timestamp: Date.now(),
    };

    // In production, this would send to an API endpoint
    // For now, we'll log it and could store locally
    console.log("Filter changed:", filterData);
    
    // TODO: Send to API endpoint when ready
    // await fetch('/api/filters', { method: 'POST', body: JSON.stringify(filterData) });
    
    // Store locally for persistence (optional)
    try {
      // Could use AsyncStorage here for persistence
      // await AsyncStorage.setItem('assetFilters', JSON.stringify(filterData));
    } catch (error) {
      console.error("Failed to store filters:", error);
    }
  },

  // Computed
  hasActiveFilters: () => {
    const state = get();
    return (
      state.sortBy !== null ||
      state.tokenCategories.size > 0 ||
      state.chains.size > 0
    );
  },
}));

