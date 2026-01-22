/**
 * Mock data service that simulates API calls
 * Includes loading states for realistic behavior
 */

import { HomeData, TradingPair, SpotlightToken, StatCard, DexMarket, NewsfeedItem } from '@/types';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data matching Figma design exactly
// Banner images will come from backend as URLs
// For now, using local banner.svg as placeholder
const mockNewsfeed: NewsfeedItem[] = [
  {
    id: '1',
    imageUrl: require('../assets/home/banner.svg'),
  },
  {
    id: '2',
    imageUrl: require('../assets/home/banner.svg'),
  },
  {
    id: '3',
    imageUrl: require('../assets/home/banner.svg'),
  },
];

const mockSpotlight: SpotlightToken[] = [
  { id: '1', symbol: 'SUI', logo: 'https://www.figma.com/api/mcp/asset/3cea74db-4833-4e82-a07c-0e5e220b5a54', change24h: -5.17 },
  { id: '2', symbol: 'AVA', logo: 'https://www.figma.com/api/mcp/asset/40134094-d8f6-4ea3-a9a5-ecd34cff1bcc', change24h: -10.17 },
  { id: '3', symbol: 'MATIC', logo: 'https://www.figma.com/api/mcp/asset/e67d2d4e-9918-425f-bf8c-ad6f401f02b8', change24h: 2.32 },
  { id: '4', symbol: 'SOL', logo: 'https://www.figma.com/api/mcp/asset/f6e0d15f-2e8c-4012-9b31-3685440d10eb', change24h: -5.17 },
  { id: '5', symbol: 'AVA', logo: 'https://www.figma.com/api/mcp/asset/3cea74db-4833-4e82-a07c-0e5e220b5a54', change24h: -5.17 },
  { id: '6', symbol: 'AVA', logo: 'https://www.figma.com/api/mcp/asset/40134094-d8f6-4ea3-a9a5-ecd34cff1bcc', change24h: -10.17 },
];

const mockTradingPairs: TradingPair[] = [
  {
    id: '1',
    baseSymbol: 'ETH',
    quoteSymbol: 'USDT',
    logo: 'https://www.figma.com/api/mcp/asset/aebb7aa9-3b79-4bd4-8cb7-e236ca0c894f',
    price: '$2,720.55',
    change24h: -5.17,
    volume: 'Vol $972.89M',
    leverage: '10X',
  },
  {
    id: '2',
    baseSymbol: 'BTC',
    quoteSymbol: 'USDT',
    logo: 'https://www.figma.com/api/mcp/asset/c81dd307-c29e-414c-8281-c26c3a7c4e43',
    price: '$83,191.21',
    change24h: 2.56,
    volume: 'Vol $2.27B',
    leverage: '10X',
  },
  {
    id: '3',
    baseSymbol: 'SOL',
    quoteSymbol: 'USDT',
    logo: 'https://www.figma.com/api/mcp/asset/3d5d5d7d-147c-4043-b418-f5ca898d47b2',
    price: '$125.16',
    change24h: -5.86,
    volume: 'Vol $358.47M',
    leverage: '10X',
  },
  {
    id: '4',
    baseSymbol: 'BNB',
    quoteSymbol: 'USDT',
    logo: 'https://www.figma.com/api/mcp/asset/5dba1d50-5473-46cf-97e3-629099a24790',
    price: '$817.75',
    change24h: -7.31,
    volume: 'Vol $42.17M',
    leverage: '10X',
  },
  {
    id: '5',
    baseSymbol: 'TWC',
    quoteSymbol: 'USDT',
    logo: 'https://www.figma.com/api/mcp/asset/90b8e0d0-e6b2-4f80-857a-d1fdb66d1b78',
    price: '$0.000001',
    change24h: 10.17,
    volume: 'Vol $1.1M',
    leverage: '5X',
  },
];

const mockStats: StatCard[] = [
  {
    id: '1',
    icon: require('../assets/home/tiwicat-token.svg'),
    value: '$0.00000000004686',
    label: 'TWC Token Price',
    iconType: 'image',
  },
  {
    id: '2',
    icon: 'chains',
    value: '50+',
    label: 'Active Chains',
    iconType: 'icon',
  },
  {
    id: '3',
    icon: 'trade-up',
    value: '$1.9k',
    label: 'Trading Volume',
    iconType: 'icon',
  },
  {
    id: '4',
    icon: 'coins',
    value: '1441',
    label: 'Trans. Count',
    iconType: 'icon',
  },
  {
    id: '5',
    icon: 'locked',
    value: '$425k',
    label: 'Total Vol Locked',
    iconType: 'icon',
  },
];

const mockDexMarkets: DexMarket[] = [
  { id: '1', name: 'Uniswap', logo: 'https://www.figma.com/api/mcp/asset/2613b8c2-b258-4228-99ec-70409d570f27' },
  { id: '2', name: 'Balancer', logo: 'https://www.figma.com/api/mcp/asset/c0d14dff-8c51-4247-8d59-ff5b64982d08' },
  { id: '3', name: 'Pancake Swap', logo: 'https://www.figma.com/api/mcp/asset/3226a184-e6f0-441a-b1b9-06c9539d8679' },
  { id: '4', name: 'Trader Joe', logo: 'https://www.figma.com/api/mcp/asset/75622cdb-e954-43bf-9db2-168b23ad027e' },
  { id: '5', name: 'Uniswap', logo: 'https://www.figma.com/api/mcp/asset/2613b8c2-b258-4228-99ec-70409d570f27' },
  { id: '6', name: 'Sushiswap', logo: 'https://www.figma.com/api/mcp/asset/b38707c0-c75e-4acf-bd41-383c19dde005' },
  { id: '7', name: 'Curve Finance', logo: 'https://www.figma.com/api/mcp/asset/54f5c5cd-7cda-48ab-8829-2cdedf20f7bd' },
  { id: '8', name: 'Raydium', logo: 'https://www.figma.com/api/mcp/asset/b38707c0-c75e-4acf-bd41-383c19dde005' },
  { id: '9', name: 'Balancer', logo: 'https://www.figma.com/api/mcp/asset/c0d14dff-8c51-4247-8d59-ff5b64982d08' },
  { id: '10', name: 'Pancake Swap', logo: 'https://www.figma.com/api/mcp/asset/3226a184-e6f0-441a-b1b9-06c9539d8679' },
];

/**
 * Simulates fetching home data from API
 * Includes loading state simulation
 */
export const fetchHomeData = async (): Promise<HomeData> => {
  // Simulate network delay (1-2 seconds)
  await delay(1500);
  
  return {
    newsfeed: mockNewsfeed,
    spotlight: mockSpotlight,
    tradingPairs: mockTradingPairs,
    stats: mockStats,
    dexMarkets: mockDexMarkets,
    isLoading: false,
  };
};


