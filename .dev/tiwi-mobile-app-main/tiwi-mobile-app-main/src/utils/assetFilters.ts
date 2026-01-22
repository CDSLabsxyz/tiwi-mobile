/**
 * Asset Filtering Utilities
 * Production-ready filtering logic for wallet assets
 */

import type { PortfolioItem } from "@/services/walletService";
import type { SortOption, TokenCategory, ChainFilter } from "@/store/filterStore";
import type { ChainId } from "@/components/sections/Swap/ChainSelectSheet";

/**
 * Maps chain filter names to chainIds
 */
const CHAIN_FILTER_TO_CHAIN_ID: Record<ChainFilter, ChainId> = {
  bsc: "apex", // BSC mapped to Apex Network
  ethereum: "ethereum",
  polygon: "verdant", // Polygon mapped to Verdant Protocol
  solana: "aegis", // Solana mapped to Aegis Core
};

/**
 * Maps chainIds to chain filter names (reverse mapping)
 */
const CHAIN_ID_TO_FILTER: Record<ChainId, ChainFilter | null> = {
  ethereum: "ethereum",
  apex: "bsc", // Apex Network represents BSC
  verdant: "polygon", // Verdant Protocol represents Polygon
  aegis: "solana", // Aegis Core represents Solana
  cortex: null, // No direct mapping
};

/**
 * Determines token category based on asset symbol/name
 * In production, this would come from asset metadata
 */
const getTokenCategory = (asset: PortfolioItem): TokenCategory | null => {
  const symbol = asset.symbol.toLowerCase();
  const name = asset.name.toLowerCase();

  // Mock categorization - in production, this would come from API
  if (symbol === "eth" || symbol === "btc") {
    return "defi";
  }
  if (symbol === "bnb") {
    return "gaming";
  }
  if (symbol === "sol") {
    return "new-listings";
  }

  return null;
};

/**
 * Applies filters to a list of assets
 */
export const applyFilters = (
  assets: PortfolioItem[],
  sortBy: SortOption,
  tokenCategories: Set<TokenCategory>,
  chains: Set<ChainFilter>
): PortfolioItem[] => {
  let filtered = [...assets];

  // Filter by token categories
  if (tokenCategories.size > 0) {
    filtered = filtered.filter((asset) => {
      const category = getTokenCategory(asset);
      return category && tokenCategories.has(category);
    });
  }

  // Filter by chains
  if (chains.size > 0) {
    filtered = filtered.filter((asset) => {
      const chainFilter = CHAIN_ID_TO_FILTER[asset.chainId];
      return chainFilter && chains.has(chainFilter);
    });
  }

  // Sort
  if (sortBy === "highest-value") {
    filtered.sort((a, b) => {
      // Remove $ and commas, then parse
      const aValue = parseFloat(a.usdValue.replace(/[$,]/g, ""));
      const bValue = parseFloat(b.usdValue.replace(/[$,]/g, ""));
      return bValue - aValue; // Descending
    });
  } else if (sortBy === "recent-activity") {
    // In production, this would use actual activity timestamps
    // For now, we'll sort by a mock property or keep original order
    // This would need activity data from the API
    filtered.sort((a, b) => {
      // Mock: sort by change24h (more recent activity = higher change)
      return Math.abs(b.change24h) - Math.abs(a.change24h);
    });
  }

  return filtered;
};


