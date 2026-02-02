/**
 * Asset Filtering & Sorting Utilities
 */

import { SortOption } from '@/store/filterStore';

export const applyFilters = (
  assets: any[],
  { sortBy, tokenCategories, chains }: {
    sortBy: SortOption;
    tokenCategories: Set<string>;
    chains: Set<string>;
  }
): any[] => {
  let filtered = [...assets];

  // Apply category filter
  if (tokenCategories && tokenCategories.size > 0) {
    filtered = filtered.filter(asset =>
      asset.category && tokenCategories.has(asset.category)
    );
  }

  // Apply chain filter
  if (chains && chains.size > 0) {
    filtered = filtered.filter(asset =>
      chains && chains.has(asset.chainId?.toString())
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const valA = parseFloat((a.usdValue || '0').toString().replace(/[$,]/g, '')) || 0;
    const valB = parseFloat((b.usdValue || '0').toString().replace(/[$,]/g, '')) || 0;

    switch (sortBy) {
      case 'balance-high':
        return valB - valA;
      case 'balance-low':
        return valA - valB;
      case 'name-az':
        return (a.name || '').localeCompare(b.name || '');
      case 'name-za':
        return (b.name || '').localeCompare(a.name || '');
      default:
        return 0;
    }
  });

  return filtered;
};
