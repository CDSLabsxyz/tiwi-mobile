/**
 * Market Types
 * Type definitions for Market features
 */

export type MarketType = 'spot' | 'perp';

export type MarketSubTab = 'favorite' | 'top' | 'spotlight' | 'new' | 'gainers' | 'losers';

export interface MarketToken {
  id: string;
  symbol: string;
  name: string;
  price: string;
  priceChange: number;
  priceChangePercent: string;
  volume: string;
  leverage: string; // e.g. 10
  isNew?: boolean;
  isFavorite?: boolean;
}
