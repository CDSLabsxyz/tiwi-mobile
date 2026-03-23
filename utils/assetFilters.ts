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

  // Apply category filter — only when categories are explicitly selected
  if (tokenCategories && tokenCategories.size > 0) {
    filtered = filtered.filter(item => {
      const category = item.category || (item.contractAddress ? 'NFT' : undefined);
      return category && tokenCategories.has(category);
    });
  }

  // Apply chain filter — only when chains are explicitly selected.
  // NOTE: The wallet query already scopes to selected chains at the API level,
  // so this acts as a client-side guard for mixed lists (e.g. tokens + NFTs).
  if (chains && chains.size > 0) {
    filtered = filtered.filter(item =>
      item.chainId != null && chains.has(item.chainId.toString())
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const getVal = (item: any) => {
      if (item.usdValue) return parseFloat(item.usdValue.toString().replace(/[$,]/g, '')) || 0;
      if (item.floorPriceUSD) return parseFloat(item.floorPriceUSD.toString().replace(/[$,]/g, '')) || 0;
      return 0;
    };

    const valA = getVal(a);
    const valB = getVal(b);

    switch (sortBy) {
      case 'recent-activity': {
        const timeA = a.lastActivityTimestamp || 0;
        const timeB = b.lastActivityTimestamp || 0;
        if (timeA !== timeB) return timeB - timeA;
        return valB - valA; // secondary sort by value
      }
      // 'value-high' and any unrecognised value → sort by USD value descending
      case 'value-high':
      default:
        return valB - valA;
    }
  });

  return filtered;
};
