import { DexMarket, HomeData, NewsfeedItem, SpotlightToken, StatCard, TradingPair } from '@/types';
import { apiClient } from './apiClient';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockNewsfeed: NewsfeedItem[] = [
  { id: '1', imageUrl: require('../assets/home/banner.svg') },
  { id: '2', imageUrl: require('../assets/home/banner.svg') },
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
  try {
    // Fetch real data from backend
    const [spotlightTokens] = await Promise.all([
      apiClient.getSpotlightTokens(true).catch(() => []),
    ]);

    // Map spotlight tokens to local types
    const spotlight: SpotlightToken[] = spotlightTokens.map(t => ({
      id: t.id,
      symbol: t.symbol,
      logo: t.logo || 'https://www.figma.com/api/mcp/asset/3cea74db-4833-4e82-a07c-0e5e220b5a54',
      change24h: 0, // Placeholder if not available in spotlight
    }));

    // Example trading pairs (could also be fetched from backend market stats)
    const tradingPairs: TradingPair[] = [
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

    // Build stats with real TWC price
    const stats: StatCard[] = [
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

    return {
      newsfeed: mockNewsfeed,
      spotlight: spotlight.length > 0 ? spotlight : [],
      tradingPairs: tradingPairs,
      stats: stats,
      dexMarkets: mockDexMarkets,
      isLoading: false,
    };
  } catch (error) {
    console.error("fetchHomeData failed", error);
    // Fallback to empty shell or last known data
    return {
      newsfeed: mockNewsfeed,
      spotlight: [],
      tradingPairs: [],
      stats: [],
      dexMarkets: mockDexMarkets,
      isLoading: false,
    };
  }
};
