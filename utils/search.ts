/**
 * Search utility with similarity matching (60-80% threshold)
 * Implements fuzzy string matching for search functionality
 */

export interface SearchableItem {
  id: string;
  label: string;
  category?: string;
  keywords?: string[];
}

/**
 * Calculate similarity score between two strings using Levenshtein distance
 * Returns a score between 0 and 1 (0 = no match, 1 = exact match)
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one string contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.85;
  }

  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  const len1 = s1.length;
  const len2 = s2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = 1 - distance / maxLen;

  return similarity;
};

/**
 * Search items with similarity matching (60-80% threshold)
 * @param query - Search query string
 * @param items - Array of searchable items
 * @param threshold - Minimum similarity score (default: 0.6, can be adjusted to 0.8)
 * @returns Filtered and sorted items by relevance
 */
export const searchItems = (
  query: string,
  items: SearchableItem[],
  threshold: number = 0.6
): SearchableItem[] => {
  if (!query || query.trim().length === 0) {
    return items;
  }

  const queryLower = query.toLowerCase().trim();
  const results: Array<{ item: SearchableItem; score: number }> = [];

  for (const item of items) {
    let maxScore = 0;

    // Check label
    const labelScore = calculateSimilarity(queryLower, item.label);
    maxScore = Math.max(maxScore, labelScore);

    // Check category
    if (item.category) {
      const categoryScore = calculateSimilarity(queryLower, item.category);
      maxScore = Math.max(maxScore, categoryScore * 0.8); // Category is less important
    }

    // Check keywords
    if (item.keywords) {
      for (const keyword of item.keywords) {
        const keywordScore = calculateSimilarity(queryLower, keyword);
        maxScore = Math.max(maxScore, keywordScore * 0.9); // Keywords are important
      }
    }

    // Check if query is a substring of label (partial match)
    if (item.label.toLowerCase().includes(queryLower)) {
      maxScore = Math.max(maxScore, 0.75);
    }

    if (maxScore >= threshold) {
      results.push({ item, score: maxScore });
    }
  }

  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);

  return results.map((r) => r.item);
};
