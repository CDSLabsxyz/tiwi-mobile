/**
 * Type definitions for the app
 */

export interface TradingPair {
  id: string;
  baseSymbol: string;
  quoteSymbol: string;
  logo: string | any;
  price: string;
  change24h: number;
  volume: string;
  leverage: string;
}

export interface SpotlightToken {
  id: string;
  symbol: string;
  logo: string | any;
  change24h: number;
}

export interface StatCard {
  id: string;
  icon?: string | any;
  value: string;
  label: string;
  iconType?: 'image' | 'icon';
}

export interface DexMarket {
  id: string;
  name: string;
  logo: string | any;
}

export interface NewsfeedItem {
  id: string;
  imageUrl: string | any;
}

export interface HomeData {
  newsfeed: NewsfeedItem[];
  spotlight: SpotlightToken[];
  tradingPairs: TradingPair[];
  stats: StatCard[];
  dexMarkets: DexMarket[];
  isLoading: boolean;
}
