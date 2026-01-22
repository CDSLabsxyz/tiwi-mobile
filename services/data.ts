import { DexMarket, HomeData, NewsfeedItem, SpotlightToken, StatCard, TradingPair } from '@/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockNewsfeed: NewsfeedItem[] = [
  { id: '1', imageUrl: require('../../assets/home/banner.svg') },
  { id: '2', imageUrl: require('../../assets/home/banner.svg') },
];

const mockSpotlight: SpotlightToken[] = [
  { id: '1', symbol: 'SUI', logo: 'https://cryptologos.cc/logos/sui-sui-logo.png', change24h: -5.17 },
  { id: '2', symbol: 'AVA', logo: 'https://cryptologos.cc/logos/avalanche-avax-logo.png', change24h: -10.17 },
  { id: '3', symbol: 'MATIC', logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png', change24h: 2.32 },
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
];

const mockStats: StatCard[] = [
  {
    id: '1',
    icon: require('../../assets/home/tiwicat-token.svg'),
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
];

const mockDexMarkets: DexMarket[] = [
  { id: '1', name: 'Uniswap', logo: 'https://cryptologos.cc/logos/uniswap-uni-logo.png' },
  { id: '2', name: 'Balancer', logo: 'https://cryptologos.cc/logos/balancer-bal-logo.png' },
  { id: '3', name: 'Pancake Swap', logo: 'https://cryptologos.cc/logos/pancakeswap-cake-logo.png' },
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
