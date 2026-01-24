/**
 * Market Service
 * Handles data fetching and filtering for the Market screen
 */

import { MarketSubTab, MarketToken } from '@/types/market';

const MOCK_TOKEN_LOGOS: Record<string, string> = {
  BTC: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
  ETH: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  SOL: 'https://cryptologos.cc/logos/solana-sol-logo.png',
  BNB: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
  AVAX: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
  MATIC: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
  DOT: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.png',
  LINK: 'https://cryptologos.cc/logos/chainlink-link-logo.png',
};

// Mock Data Analysis
// The design shows tokens like Zora/Base, we'll use a mix of popular and new
const SPOT_TOKENS: MarketToken[] = [
  {
    id: '1',
    symbol: 'BTC',
    name: 'Bitcoin',
    price: '$83,191.21',
    priceChange: 2118.55,
    priceChangePercent: '+2.56%',
    volume: '$2.27B',
    leverage: '100',
    isFavorite: true,
  },
  {
    id: '2',
    symbol: 'ETH',
    name: 'Ethereum',
    price: '$2,720.55',
    priceChange: -148.33,
    priceChangePercent: '-5.17%',
    volume: '$972.89M',
    leverage: '100',
    isFavorite: true,
  },
  {
    id: '3',
    symbol: 'SOL',
    name: 'Solana',
    price: '$145.22',
    priceChange: 16.08,
    priceChangePercent: '+12.45%',
    volume: '$542.1M',
    leverage: '50',
    isFavorite: true,
  },
  {
    id: '4',
    symbol: 'BNB',
    name: 'BNB',
    price: '$592.10',
    priceChange: -7.37,
    priceChangePercent: '-1.23%',
    volume: '$122.9M',
    leverage: '50',
  },
  {
    id: '5',
    symbol: 'SUI',
    name: 'Sui',
    price: '$1.82',
    priceChange: -0.09,
    priceChangePercent: '-5.17%',
    volume: '$89.2M',
    leverage: '20',
    isNew: true,
  },
  {
    id: '6',
    symbol: 'ZORA',
    name: 'Zora',
    price: '$0.05189',
    priceChange: 0.00058,
    priceChangePercent: '+1.13%',
    volume: '$9.55M',
    leverage: '10',
    isNew: true,
  },
  {
    id: '7',
    symbol: 'DEGEN',
    name: 'Degen',
    price: '$0.0245',
    priceChange: 0.0034,
    priceChangePercent: '+15.82%',
    volume: '$12.4M',
    leverage: '10',
    isNew: true,
  },
];

const PERP_TOKENS: MarketToken[] = SPOT_TOKENS.map(t => ({
  ...t,
  id: `perp-${t.id}`,
  volume: `$${(parseFloat(t.volume.replace(/[^0-9.]/g, '')) * 1.5).toFixed(2)}${t.volume.slice(-1)}`, // Mock higher volume for perps
}));

export const fetchMarketData = async (): Promise<{ spot: MarketToken[]; perp: MarketToken[] }> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    spot: SPOT_TOKENS,
    perp: PERP_TOKENS,
  };
};

export const filterTokensBySubTab = (tokens: MarketToken[], tab: MarketSubTab): MarketToken[] => {
  switch (tab) {
    case 'favorite':
      return tokens.filter(t => t.isFavorite);
    case 'spotlight':
      // Just some arbitrary logic for spotlight
      return tokens.filter(t => ['BTC', 'ETH', 'SOL', 'ZORA'].includes(t.symbol));
    case 'new':
      return tokens.filter(t => t.isNew);
    case 'gainers':
      return [...tokens].sort((a, b) => b.priceChange - a.priceChange).filter(t => t.priceChange > 0);
    case 'losers':
      return [...tokens].sort((a, b) => a.priceChange - b.priceChange).filter(t => t.priceChange < 0);
    case 'top':
    default:
      // Default sor by volume (mock implementation)
      return tokens;
  }
};

export const searchTokens = (tokens: MarketToken[], query: string): MarketToken[] => {
  const q = query.toLowerCase();
  return tokens.filter(t => 
    t.symbol.toLowerCase().includes(q) || 
    t.name.toLowerCase().includes(q)
  );
};
