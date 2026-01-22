/**
 * Market types for Spot and Perp trading
 */

export type MarketType = 'spot' | 'perp';
export type MarketSubTab = 'favorite' | 'top' | 'spotlight' | 'new' | 'gainers' | 'losers';

export interface MarketToken {
  id: string;
  symbol: string;
  pair: string; // e.g., "ZORA/USDT"
  leverage: number; // e.g., 10, 5
  volume: string; // e.g., "$9.46M"
  price: string; // e.g., "$0.051"
  priceChange: number; // e.g., 1.13 (percentage)
  priceChangePercent: string; // e.g., "+1.13%"
  isFavorite?: boolean;
  marketType: MarketType;
}

export interface MarketData {
  spot: MarketToken[];
  perp: MarketToken[];
}





