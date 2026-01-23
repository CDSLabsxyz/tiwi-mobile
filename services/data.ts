import { DexMarket, HomeData, NewsfeedItem, SpotlightToken, StatCard, TradingPair } from '@/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockNewsfeed: NewsfeedItem[] = [
  { id: '1', imageUrl: require('../assets/home/banner.svg') },
  { id: '2', imageUrl: require('../assets/home/banner.svg') },
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
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    price: '$2,720.55',
    change24h: -5.17,
    volume: 'Vol $972.89M',
    leverage: '10X',
  },
  {
    id: '2',
    baseSymbol: 'BTC',
    quoteSymbol: 'USDT',
    logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    price: '$83,191.21',
    change24h: 2.56,
    volume: 'Vol $2.27B',
    leverage: '10X',
  },
  {
    id: '3',
    baseSymbol: 'SOL',
    quoteSymbol: 'USDT',
    logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    price: '$145.22',
    change24h: 12.45,
    volume: 'Vol $542.1M',
    leverage: '10X',
  },
  {
    id: '4',
    baseSymbol: 'BNB',
    quoteSymbol: 'USDT',
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    price: '$592.10',
    change24h: -1.23,
    volume: 'Vol $122.9M',
    leverage: '10X',
  },
];

const mockStats: StatCard[] = [
  {
    id: '1',
    icon: require('../assets/home/tiwicat-token.svg'),
    value: '$0.04686',
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
  { id: '1', name: 'Uniswap', logo: 'https://cryptologos.cc/logos/uniswap-uni-logo.png' },
  { id: '2', name: 'Balancer', logo: 'https://cryptologos.cc/logos/balancer-bal-logo.png' },
  { id: '3', name: 'Pancake Swap', logo: 'https://cryptologos.cc/logos/pancakeswap-cake-logo.png' },
  { id: '4', name: 'Trader Joe', logo: 'https://cryptologos.cc/logos/trader-joe-joe-logo.png' },
  { id: '5', name: 'Raydium', logo: 'https://cryptologos.cc/logos/raydium-ray-logo.png' },
  { id: '6', name: 'SushiSwap', logo: 'https://cryptologos.cc/logos/sushiswap-sushi-logo.png' },
  { id: '7', name: 'Curve', logo: 'https://cryptologos.cc/logos/curve-dao-token-crv-logo.png' },
  { id: '8', name: 'Jupiter', logo: 'https://cryptologos.cc/logos/jupiter-ag-jup-logo.png' },
  { id: '9', name: '1inch', logo: 'https://cryptologos.cc/logos/1inch-1inch-logo.png' },
  { id: '10', name: 'Aave', logo: 'https://cryptologos.cc/logos/aave-aave-logo.png' },
];

export const fetchHomeData = async (): Promise<HomeData> => {
  await delay(1000);
  return {
    newsfeed: mockNewsfeed,
    spotlight: mockSpotlight,
    tradingPairs: mockTradingPairs,
    stats: mockStats,
    dexMarkets: mockDexMarkets,
    isLoading: false,
  };
};