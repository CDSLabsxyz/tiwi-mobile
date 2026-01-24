/**
 * Asset Filtering & Sorting Utilities
 */

import { PortfolioItem } from '@/services/walletService';
import { SortOption } from '@/store/filterStore';

export const applyFilters = (
  assets: PortfolioItem[],
  sortBy: SortOption,
  tokenCategories: Set<string>,
  chains: Set<string>
): PortfolioItem[] => {
  let filtered = [...assets];
  
  // Apply category filter
  if (tokenCategories.size > 0) {
    filtered = filtered.filter(asset => 
      asset.category && tokenCategories.has(asset.category)
    );
  }
  
  // Apply chain filter
  if (chains.size > 0) {
    filtered = filtered.filter(asset => 
      chains.has(asset.chainId)
    );
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'balance-high':
        return parseFloat(b.usdValue.replace(/[$,]/g, '')) - parseFloat(a.usdValue.replace(/[$,]/g, ''));
      case 'balance-low':
        return parseFloat(a.usdValue.replace(/[$,]/g, '')) - parseFloat(b.usdValue.replace(/[$,]/g, ''));
      case 'name-az':
        return a.name.localeCompare(b.name);
      case 'name-za':
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });
  
  return filtered;
};
