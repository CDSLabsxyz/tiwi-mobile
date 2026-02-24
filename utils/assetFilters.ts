/**
 * Asset Filtering & Sorting Utilities
 */

import { SortOption } from '@/store/filterStore';

export const applyFilters = (
  items: any[],
  { sortBy, tokenCategories, chains }: {
    sortBy: SortOption;
    tokenCategories: Set<string>;
    chains: Set<string>;
  }
): any[] => {
  let filtered = [...items];

  // Apply category filter
  if (tokenCategories && tokenCategories.size > 0) {
    filtered = filtered.filter(item => {
      // For NFTs, we might use collection name or a category if available
      const category = item.category || (item.contractAddress ? 'NFT' : undefined);
      return category && tokenCategories.has(category);
    });
  }

  // Apply chain filter
  if (chains && chains.size > 0) {
    filtered = filtered.filter(item =>
      item.chainId && chains.has(item.chainId.toString())
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    // Value Calculation: Handles USD balance for tokens or floor price for NFTs
    const getVal = (item: any) => {
      if (item.usdValue) return parseFloat(item.usdValue.toString().replace(/[$,]/g, '')) || 0;
      if (item.floorPriceUSD) return parseFloat(item.floorPriceUSD.toString().replace(/[$,]/g, '')) || 0;
      return 0;
    };

    const valA = getVal(a);
    const valB = getVal(b);

    switch (sortBy) {
      case 'value-high':
        return valB - valA;
      case 'recent-activity':
        // Fallback to value if activity timestamp is missing
        const timeA = a.lastActivityTimestamp || 0;
        const timeB = b.lastActivityTimestamp || 0;
        if (timeA === timeB) return valB - valA;
        return timeB - timeA;
      default:
        return 0;
    }
  });

  return filtered;
};
