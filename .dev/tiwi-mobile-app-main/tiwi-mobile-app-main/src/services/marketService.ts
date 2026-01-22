/**
 * Market Service
 * Handles fetching and filtering market data for Spot and Perp trading
 * 
 * TODO: Replace with real API endpoints
 * Recommended APIs:
 * - CoinGecko API: https://www.coingecko.com/en/api
 * - Binance API: https://binance-docs.github.io/apidocs/spot/en/
 * - Bybit API: https://bybit-exchange.github.io/docs/v5/intro
 * - DEX Aggregators: 1inch, 0x Protocol, Paraswap
 */

import { MarketToken, MarketType, MarketSubTab, MarketData } from '@/types/market';

// Mock data - Replace with real API calls
const mockSpotTokens: MarketToken[] = [
  {
    id: 'zora-spot',
    symbol: 'ZORA',
    pair: 'ZORA/USDT',
    leverage: 10,
    volume: '$9.46M',
    price: '$0.051',
    priceChange: 1.13,
    priceChangePercent: '+1.13%',
    marketType: 'spot',
  },
  {
    id: 'eth-spot',
    symbol: 'ETH',
    pair: 'ETH/USDT',
    leverage: 10,
    volume: '$972.89M',
    price: '$2,720.55',
    priceChange: -5.17,
    priceChangePercent: '-5.17%',
    marketType: 'spot',
  },
  {
    id: 'btc-spot',
    symbol: 'BTC',
    pair: 'BTC/USDT',
    leverage: 10,
    volume: '$2.27B',
    price: '$83,191.21',
    priceChange: 2.56,
    priceChangePercent: '+2.56%',
    marketType: 'spot',
  },
  {
    id: 'sol-spot',
    symbol: 'SOL',
    pair: 'SOL/USDT',
    leverage: 10,
    volume: '$358.47M',
    price: '$125.16',
    priceChange: -5.86,
    priceChangePercent: '-5.86%',
    marketType: 'spot',
  },
  {
    id: 'bnb-spot',
    symbol: 'BNB',
    pair: 'BNB/USDT',
    leverage: 10,
    volume: '$42.17M',
    price: '$817.75',
    priceChange: -7.31,
    priceChangePercent: '-7.31%',
    marketType: 'spot',
  },
  {
    id: 'twc-spot',
    symbol: 'TWC',
    pair: 'TWC/USDT',
    leverage: 5,
    volume: '$1.1M',
    price: '$0.0000012',
    priceChange: 10.17,
    priceChangePercent: '+10.17%',
    marketType: 'spot',
  },
  {
    id: 'cake-spot',
    symbol: 'CAKE',
    pair: 'CAKE/USDT',
    leverage: 10,
    volume: '$14.68M',
    price: '$2.32',
    priceChange: -5.17,
    priceChangePercent: '-5.17%',
    marketType: 'spot',
  },
  {
    id: 'virtual-spot',
    symbol: 'VIRTUAL',
    pair: 'VIRTUAL/USDT',
    leverage: 10,
    volume: '$26.92M',
    price: '$0.9031',
    priceChange: 2.56,
    priceChangePercent: '+2.56%',
    marketType: 'spot',
  },
  {
    id: 'aster-spot',
    symbol: 'ASTER',
    pair: 'ASTER/USDT',
    leverage: 10,
    volume: '$19.20M',
    price: '$1.14',
    priceChange: -5.86,
    priceChangePercent: '-5.86%',
    marketType: 'spot',
  },
  {
    id: 'quq-spot',
    symbol: 'QUQ',
    pair: 'QUQ/USDT',
    leverage: 10,
    volume: '$243.11M',
    price: '$0.0036',
    priceChange: -7.31,
    priceChangePercent: '-7.31%',
    marketType: 'spot',
  },
  {
    id: 'link-spot',
    symbol: 'LINK',
    pair: 'LINK/USDT',
    leverage: 5,
    volume: '$8.50',
    price: '$12.68',
    priceChange: 10.17,
    priceChangePercent: '+10.17%',
    marketType: 'spot',
  },
  {
    id: 'aero-spot',
    symbol: 'AERO',
    pair: 'AERO/USDT',
    leverage: 10,
    volume: '$11.91M',
    price: '$0.67',
    priceChange: -5.86,
    priceChangePercent: '-5.86%',
    marketType: 'spot',
  },
  {
    id: 'tiwi-spot',
    symbol: 'TIWI',
    pair: 'TIWI/USDT',
    leverage: 5,
    volume: '$1.1M',
    price: '$0.000001',
    priceChange: 10.17,
    priceChangePercent: '+10.17%',
    marketType: 'spot',
  },
];

// Perp tokens (same structure, different market type)
const mockPerpTokens: MarketToken[] = mockSpotTokens.map((token) => ({
  ...token,
  id: token.id.replace('-spot', '-perp'),
  marketType: 'perp' as MarketType,
}));

/**
 * Fetch market data
 * TODO: Replace with real API call
 */
export const fetchMarketData = async (): Promise<MarketData> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return {
    spot: mockSpotTokens,
    perp: mockPerpTokens,
  };
};

/**
 * Filter tokens by sub-tab
 */
export const filterTokensBySubTab = (
  tokens: MarketToken[],
  subTab: MarketSubTab
): MarketToken[] => {
  switch (subTab) {
    case 'favorite':
      return tokens.filter((token) => token.isFavorite);
    case 'top':
      // Sort by volume (descending)
      return [...tokens].sort((a, b) => {
        const volA = parseFloat(a.volume.replace(/[^0-9.]/g, ''));
        const volB = parseFloat(b.volume.replace(/[^0-9.]/g, ''));
        return volB - volA;
      });
    case 'spotlight':
      // Return tokens with high volume and positive change
      return tokens
        .filter((token) => token.priceChange > 0)
        .sort((a, b) => b.priceChange - a.priceChange)
        .slice(0, 10);
    case 'new':
      // Return recently added tokens (mock - in production, use timestamp)
      return tokens.slice(-5);
    case 'gainers':
      // Sort by positive price change (descending)
      return [...tokens]
        .filter((token) => token.priceChange > 0)
        .sort((a, b) => b.priceChange - a.priceChange);
    case 'losers':
      // Sort by negative price change (ascending)
      return [...tokens]
        .filter((token) => token.priceChange < 0)
        .sort((a, b) => a.priceChange - b.priceChange);
    default:
      return tokens;
  }
};

/**
 * Search tokens by query
 */
export const searchTokens = (
  tokens: MarketToken[],
  query: string
): MarketToken[] => {
  if (!query.trim()) return tokens;
  
  const queryLower = query.toLowerCase().trim();
  return tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(queryLower) ||
      token.pair.toLowerCase().includes(queryLower)
  );
};





