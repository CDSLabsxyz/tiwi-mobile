import { create } from 'zustand';

export type SortOption = 'value-high' | 'recent-activity';

interface FilterState {
  sortBy: SortOption;
  tokenCategories: Set<string>;
  chains: Set<string>;

  // Actions
  setSortBy: (sort: SortOption) => void;
  toggleTokenCategory: (category: string) => void;
  toggleChain: (chain: string) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  sortBy: 'value-high',
  tokenCategories: new Set<string>(),
  chains: new Set<string>(),

  setSortBy: (sort) => set({ sortBy: sort }),

  toggleTokenCategory: (category) => set((state) => {
    const newCategories = new Set(state.tokenCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    return { tokenCategories: newCategories };
  }),

  toggleChain: (chain) => set((state) => {
    const newChains = new Set(state.chains);
    if (newChains.has(chain)) {
      newChains.delete(chain);
    } else {
      newChains.add(chain);
    }
    return { chains: newChains };
  }),

  resetFilters: () => set({
    sortBy: 'value-high',
    tokenCategories: new Set<string>(),
    chains: new Set<string>(),
  }),
}));
