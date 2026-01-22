/**
 * Type definitions for the app
 */

export interface TradingPair {
  id: string;
  baseSymbol: string;
  quoteSymbol: string;
  logo: string;
  price: string;
  change24h: number;
  volume: string;
  leverage: string;
}

export interface SpotlightToken {
  id: string;
  symbol: string;
  logo: string;
  change24h: number;
}

export interface MarketTab {
  id: string;
  label: string;
  isActive: boolean;
}

export interface StatCard {
  id: string;
  icon?: string;
  value: string;
  label: string;
  iconType?: 'image' | 'icon';
}

export interface DexMarket {
  id: string;
  name: string;
  logo: string;
}

export interface NewsfeedItem {
  id: string;
  imageUrl: string | number; // URL (string) of the banner image from backend, or local asset (number from require)
}

export interface HomeData {
  newsfeed: NewsfeedItem[];
  spotlight: SpotlightToken[];
  tradingPairs: TradingPair[];
  stats: StatCard[];
  dexMarkets: DexMarket[];
  isLoading: boolean;
}


