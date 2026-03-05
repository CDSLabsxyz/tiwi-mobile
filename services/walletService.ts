/**
 * Wallet Service
 * Simulates API calls to fetch wallet data from backend
 * Production-ready structure with chain tracking
 */

import type { ChainId } from "@/components/sections/Swap/ChainSelectSheet";
import { apiClient } from "@/services/apiClient";
import { useWalletStore } from "@/store/walletStore";
import { formatTokenAmount } from "@/utils/formatting";

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface PortfolioChange {
  amount: string; // e.g., "+$61.69"
  percent: string; // e.g., "+2.51%"
  period: string; // e.g., "today"
}

export interface WalletData {
  address: string;
  totalBalance: string;
  usdBalance: number;
  portfolioChange: PortfolioChange;
  claimableRewards: string; // e.g., "$8.52"
  portfolio: PortfolioItem[];
  activities: Activity[];
  transactionHistory: Transaction[];
}

export interface PortfolioItem {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  balance: string;
  usdValue: string;
  change24h: number;
  chainId: ChainId; // The chain this token belongs to
  address: string; // Contract address or 'native'
  decimals: number; // Token decimals
  chartData?: string; // Placeholder for chart image URL (70px wide, 32px tall)
}

export interface Activity {
  id: string;
  type: 'swap' | 'stake' | 'unstake' | 'transfer' | 'receive';
  token: string;
  amount: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface Transaction {
  id: string;
  hash: string;
  type: 'swap' | 'stake' | 'unstake' | 'transfer' | 'receive';
  from: string;
  to: string;
  token: string;
  amount: string;
  usdValue: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Fetches wallet data from backend API
 * Simulates API call with loading delay
 */
export const fetchWalletData = async (address: string): Promise<WalletData> => {
  // Simulate API delay (500ms - 1.5s)
  await delay(500 + Math.random() * 1000);

  // Mock wallet data matching Figma design
  // Production-ready structure with chain information
  const mockPortfolio: PortfolioItem[] = [
    {
      id: '1',
      symbol: 'BTC',
      name: 'Bitcoin',
      logo: 'https://www.figma.com/api/mcp/asset/2f4942b6-9793-4b55-9683-2b68af5b886b',
      balance: '0.01912343',
      usdValue: '$10,234.23',
      change24h: 2.5,
      chainId: 'ethereum',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
      decimals: 8,
      chartData: 'https://www.figma.com/api/mcp/asset/a34680f1-9f3f-432d-9c1d-762d12a6bd6b',
    },
    {
      id: '2',
      symbol: 'SOL',
      name: 'Solana',
      logo: 'https://www.figma.com/api/mcp/asset/48caf229-149d-4424-863d-1287a8f8eead',
      balance: '20,000.85',
      usdValue: '$10,234.23',
      change24h: -1.2,
      chainId: 'aegis',
      address: 'native',
      decimals: 9,
      chartData: 'https://www.figma.com/api/mcp/asset/71d4ca90-aa21-438e-ae22-6d8a1be63c75',
    },
    {
      id: '3',
      symbol: 'BNB',
      name: 'BNB Smart Chain',
      logo: 'https://www.figma.com/api/mcp/asset/ae5b8259-54bc-495a-8e22-e9133f8ed09a',
      balance: '1,580.8565',
      usdValue: '$10,234.23',
      change24h: 0.8,
      chainId: 'apex',
      address: 'native',
      decimals: 18,
      chartData: 'https://www.figma.com/api/mcp/asset/a6e0181b-66a8-4fbb-b069-6ceace500a3f',
    },
    {
      id: '4',
      symbol: 'ETH',
      name: 'Ethereum',
      logo: 'https://www.figma.com/api/mcp/asset/939391c7-5d01-4394-bc69-b84bf6df5bfe',
      balance: '0.1582890708008970',
      usdValue: '$10,234.23',
      change24h: -2.5,
      chainId: 'ethereum',
      address: 'native',
      decimals: 18,
      chartData: 'https://www.figma.com/api/mcp/asset/71d4ca90-aa21-438e-ae22-6d8a1be63c75',
    },
  ];

  const mockActivities: Activity[] = [
    {
      id: '1',
      type: 'swap',
      token: 'ETH',
      amount: '0.5',
      timestamp: Date.now() - 3600000, // 1 hour ago
      status: 'completed',
    },
    {
      id: '2',
      type: 'stake',
      token: 'SUI',
      amount: '100',
      timestamp: Date.now() - 7200000, // 2 hours ago
      status: 'completed',
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: '1',
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      type: 'swap',
      from: address,
      to: '0xabcdef1234567890abcdef1234567890abcdef1234',
      token: 'ETH',
      amount: '0.5',
      usdValue: '$1,360.28',
      timestamp: Date.now() - 3600000,
      status: 'completed',
    },
    {
      id: '2',
      hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      type: 'stake',
      from: address,
      to: '0x1234567890abcdef1234567890abcdef1234567890',
      token: 'SUI',
      amount: '100',
      usdValue: '$50.00',
      timestamp: Date.now() - 7200000,
      status: 'completed',
    },
  ];

  return {
    address,
    totalBalance: '$4,631.21',
    usdBalance: 4631.21,
    portfolioChange: {
      amount: '+$61.69',
      percent: '+2.51%',
      period: 'today',
    },
    claimableRewards: '$0.00',
    portfolio: mockPortfolio,
    activities: mockActivities,
    transactionHistory: mockTransactions,
  };
};

/**
 * Fetches wallet balance from backend API
 */
export const fetchWalletBalance = async (address: string): Promise<string> => {
  await delay(300 + Math.random() * 500);
  // In production, this would calculate from portfolio items
  return '$0.00';
};

/**
 * Fetches portfolio data from backend API
 */
export const fetchPortfolio = async (address: string): Promise<PortfolioItem[]> => {
  await delay(400 + Math.random() * 600);
  const walletData = await fetchWalletData(address);
  return walletData.portfolio;
};

/**
 * Fetches transaction history from backend API
 */
export const fetchTransactionHistory = async (address: string): Promise<Transaction[]> => {
  await delay(400 + Math.random() * 600);
  const walletData = await fetchWalletData(address);
  return walletData.transactionHistory;
};

/**
 * Fetches activities from backend API
 */
export const fetchActivities = async (address: string): Promise<Activity[]> => {
  await delay(400 + Math.random() * 600);
  const walletData = await fetchWalletData(address);
  return walletData.activities;
};

/**
 * NFT Interfaces
 */
export interface NFTItem {
  id: string; // contractAddress-tokenId
  name: string;
  mediaUrl: string;
  floorPrice?: string;
  collectionName?: string;
  chainId: number;
  contractAddress: string;
  tokenId: string;
}

export interface NFTDetail {
  id: string;
  name: string;
  mediaUrl: string;
  totalUSDVolume?: string;
  floorPriceUSD?: string;
  listedPercentage?: number;
  numberOfOwners?: number;
  chainId: number;
  creationDate?: string;
  createdBy?: string;
  isVerified: boolean;
  activities: NFTActivity[];
  description?: string;
  collectionName?: string;
}

export interface NFTActivity {
  id: string;
  type: 'received' | 'sent' | 'listed' | 'unlisted' | 'sold' | 'bought' | 'transfer' | 'mint' | 'burn' | 'sale';
  nftName: string;
  amount?: string;
  timestamp: number;
  date: string;
}

/**
 * Fetches NFTs for a wallet address from actual API
 */
export const fetchNFTs = async (address: string): Promise<NFTItem[]> => {
  try {
    const apiNfts = await apiClient.getNFTs(address);

    // Normalize and handle missing data
    return apiNfts.map(nft => {
      const id = `${nft.contractAddress}-${nft.tokenId}`;
      return {
        id,
        name: nft.name || 'Unnamed NFT',
        mediaUrl: nft.imageThumbnail || nft.image || 'https://via.placeholder.com/400?text=No+Image',
        floorPrice: nft.floorPriceUSD ? `$${parseFloat(nft.floorPriceUSD).toLocaleString()}` : (nft.floorPrice ? `${nft.floorPrice} ${nft.collectionSymbol || 'ETH'}` : '0 ETH'),
        collectionName: nft.collectionName,
        chainId: nft.chainId,
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId
      };
    });
  } catch (error) {
    console.error("Failed to fetch real NFTs, falling back to mocks:", error);
    await delay(600);
    return [
      {
        id: 'mock-1',
        name: 'Cartoon-bird',
        mediaUrl: 'https://www.figma.com/api/mcp/asset/be2cc277-351e-410f-87ad-eb4a2887eeda',
        floorPrice: '$0',
        collectionName: 'Cartoon-bird',
        chainId: 1,
        contractAddress: '0x1',
        tokenId: '1'
      },
      {
        id: 'mock-2',
        name: 'Alien Amphibian',
        mediaUrl: 'https://www.figma.com/api/mcp/asset/d9a5806c-183c-4f98-8ae0-3a2694033d27',
        floorPrice: '$0',
        collectionName: 'Alien Amphibian',
        chainId: 1,
        contractAddress: '0x2',
        tokenId: '2'
      },
    ];
  }
};

/**
 * Fetches detailed NFT information by ID from actual API
 */
export const fetchNFTDetail = async (nftId: string): Promise<NFTDetail> => {
  try {
    const apiDetail = await apiClient.getNFTDetail(nftId);

    // Normalize and handle missing data
    return {
      id: `${apiDetail.contractAddress}-${apiDetail.tokenId}`,
      name: apiDetail.name || 'Unnamed NFT',
      mediaUrl: apiDetail.image || apiDetail.imageThumbnail || 'https://via.placeholder.com/400?text=No+Image',
      totalUSDVolume: apiDetail.totalVolumeUSD,
      floorPriceUSD: apiDetail.floorPriceUSD,
      listedPercentage: typeof apiDetail.listedPercentage === 'number' ? apiDetail.listedPercentage : undefined,
      numberOfOwners: typeof apiDetail.owners === 'number' ? apiDetail.owners : undefined,
      chainId: apiDetail.chainId,
      creationDate: apiDetail.blockTimestampMinted ? new Date(apiDetail.blockTimestampMinted).toLocaleDateString() : undefined,
      createdBy: apiDetail.minterAddress,
      isVerified: !!apiDetail.isVerified,
      description: apiDetail.description,
      collectionName: apiDetail.collectionName,
      activities: (apiDetail.activities || []).map(act => ({
        id: act.id,
        type: act.type as any,
        nftName: act.nftName,
        amount: act.amount,
        timestamp: act.timestamp,
        date: act.date
      }))
    };
  } catch (error) {
    console.error("Failed to fetch real NFT detail, falling back to mock:", error);
    await delay(600);
    return {
      id: nftId,
      name: 'Cartoon-bird',
      mediaUrl: 'https://www.figma.com/api/mcp/asset/065526bb-efba-47f4-936b-bc3837aba9e8',
      totalUSDVolume: '1200000',
      floorPriceUSD: '15000',
      listedPercentage: 3.05,
      numberOfOwners: 5320,
      chainId: 1,
      creationDate: 'April 2025',
      createdBy: 'Cartoon-bird_deployer',
      isVerified: true,
      collectionName: 'Cartoon-bird',
      activities: [],
    };
  }
};

/**
 * Asset Detail Interfaces
 */
export type ChartTimePeriod = '1D' | '1W' | '1M' | '1Y' | '5Y' | 'All';

export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export interface AssetDetail {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  balance: string;
  usdValue: string;
  change24h: number; // Percentage change (can be negative)
  change24hAmount: string; // e.g., "0,10%"
  chainId: ChainId; // The chain this token belongs to
  address: string;
  decimals: number;
  priceUSD: string;
  chartData: {
    [key in ChartTimePeriod]: ChartDataPoint[];
  };
  activities: AssetActivity[];
}

export interface AssetActivity {
  id: string;
  type: 'sent' | 'received' | 'swap' | 'stake' | 'unstake';
  amount: string; // e.g., "0.017 ETH"
  usdValue: string; // Legacy field for static USD value
  usdAmount?: number; // Numeric USD value for regional conversion
  timestamp: number;
  date: string; // Formatted date, e.g., "Jan 4, 2024"
}

/**
 * Fetches all activities for an asset
 */
export const getAllAssetActivities = async (assetId: string): Promise<AssetActivity[]> => {
  try {
    // Get the asset detail to use the correct symbol
    const assetDetail = await fetchAssetDetail(assetId);
    const symbol = assetDetail.symbol.toUpperCase();

    // Fetch real transaction history from API
    // We expect the address to be passed or derived somehow. 
    // Let's add it to the function parameters.
    const activeAddress = useWalletStore.getState().address;
    if (!activeAddress) throw new Error("No active wallet");

    const response = await apiClient.getTransactionHistory({
      address: activeAddress,
      limit: 50,
    });

    const formatDate = (timestamp: number): string => {
      const date = new Date(timestamp);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    // Filter by token symbol and map to AssetActivity interface
    const filteredActivities: AssetActivity[] = response.transactions
      .filter(tx => tx.tokenSymbol.toUpperCase() === symbol || tx.tokenAddress.toLowerCase() === assetId.toLowerCase())
      .map(tx => ({
        id: tx.id,
        type: tx.type.toLowerCase() as any,
        amount: `${formatTokenAmount(tx.amountFormatted)} ${tx.tokenSymbol}`,
        usdValue: tx.usdValue,
        usdAmount: parseFloat(tx.usdValue.replace(/[$,]/g, '')),
        timestamp: tx.timestamp,
        date: formatDate(tx.timestamp),
      }));

    return filteredActivities;
  } catch (error) {
    console.error("Failed to fetch real activities, falling back to mocks:", error);

    // Fallback Mock Logic (Previous implementation)
    await delay(400);
    const assetDetail = await fetchAssetDetail(assetId);
    const symbol = assetDetail.symbol;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const activityTypes: Array<'sent' | 'received' | 'swap' | 'stake' | 'unstake'> = ['sent', 'received', 'swap', 'stake', 'unstake'];

    const formatDate = (date: Date): string => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    return Array.from({ length: 10 }, (_, index) => {
      const timestamp = now - (index * 2 * oneDay);
      const amount = (0.017 + index * 0.01).toFixed(3);
      return {
        id: `mock-${index}`,
        type: activityTypes[index % activityTypes.length],
        amount: `${amount} ${symbol}`,
        usdValue: `$${(parseFloat(amount) * 2500).toFixed(2)}`,
        timestamp,
        date: formatDate(new Date(timestamp)),
      };
    });
  }
};

// Cache for portfolio data to avoid repeated fetches
let cachedPortfolio: PortfolioItem[] | null = null;

/**
 * Gets portfolio data (cached or fresh)
 */
const getPortfolioData = async (): Promise<PortfolioItem[]> => {
  if (cachedPortfolio) {
    return cachedPortfolio;
  }

  // Mock portfolio data (same as in fetchWalletData)
  // Production-ready structure with chain information
  const mockPortfolio: PortfolioItem[] = [
    {
      id: '1',
      symbol: 'BTC',
      name: 'Bitcoin',
      logo: 'https://www.figma.com/api/mcp/asset/2f4942b6-9793-4b55-9683-2b68af5b886b',
      balance: '0.01912343',
      usdValue: '$10,234.23',
      change24h: 2.5,
      chainId: 'ethereum',
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
      decimals: 8,
      chartData: 'https://www.figma.com/api/mcp/asset/a34680f1-9f3f-432d-9c1d-762d12a6bd6b',
    },
    {
      id: '2',
      symbol: 'SOL',
      name: 'Solana',
      logo: 'https://www.figma.com/api/mcp/asset/48caf229-149d-4424-863d-1287a8f8eead',
      balance: '20,000.85',
      usdValue: '$10,234.23',
      change24h: -1.2,
      chainId: 'aegis',
      address: 'native',
      decimals: 9,
      chartData: 'https://www.figma.com/api/mcp/asset/71d4ca90-aa21-438e-ae22-6d8a1be63c75',
    },
    {
      id: '3',
      symbol: 'BNB',
      name: 'BNB Smart Chain',
      logo: 'https://www.figma.com/api/mcp/asset/ae5b8259-54bc-495a-8e22-e9133f8ed09a',
      balance: '1,580.8565',
      usdValue: '$10,234.23',
      change24h: 0.8,
      chainId: 'apex',
      address: 'native',
      decimals: 18,
      chartData: 'https://www.figma.com/api/mcp/asset/a6e0181b-66a8-4fbb-b069-6ceace500a3f',
    },
    {
      id: '4',
      symbol: 'ETH',
      name: 'Ethereum',
      logo: 'https://www.figma.com/api/mcp/asset/939391c7-5d01-4394-bc69-b84bf6df5bfe',
      balance: '0.15828',
      usdValue: '$10,234.23',
      change24h: -2.5,
      chainId: 'ethereum',
      address: 'native',
      decimals: 18,
      chartData: 'https://www.figma.com/api/mcp/asset/71d4ca90-aa21-438e-ae22-6d8a1be63c75',
    },
  ];

  cachedPortfolio = mockPortfolio;
  return mockPortfolio;
};

/**
 * Fetches detailed asset information by ID
 * Returns asset-specific data based on the assetId
 */
export const fetchAssetDetail = async (assetId: string): Promise<AssetDetail> => {
  // await delay(400 + Math.random() * 600);

  // Get the portfolio to find the asset
  const portfolio = await getPortfolioData();
  const portfolioAsset = portfolio.find((asset) => asset.id === assetId);

  // If asset not found in portfolio, return default ETH data
  if (!portfolioAsset) {
    // Generate mock chart data - positive trend (green) or negative trend (red)
    const isPositive = Math.random() > 0.5;
    const basePrice = 10000;
    const variation = isPositive ? 0.1 : -0.1;

    const generateChartData = (points: number, trend: 'up' | 'down'): ChartDataPoint[] => {
      const data: ChartDataPoint[] = [];
      const now = Date.now();
      const interval = 86400000 / points;

      for (let i = 0; i < points; i++) {
        const timestamp = now - (points - i) * interval;
        const noise = (Math.random() - 0.5) * 0.02;
        const trendValue = trend === 'up'
          ? basePrice * (1 + (i / points) * variation + noise)
          : basePrice * (1 - (i / points) * Math.abs(variation) + noise);

        data.push({
          timestamp,
          value: Math.max(trendValue, basePrice * 0.9),
        });
      }

      return data;
    };

    return {
      id: assetId,
      symbol: 'ETH',
      name: 'Ethereum',
      logo: 'https://www.figma.com/api/mcp/asset/142d5172-a920-40ef-a06c-8e381f587e81',
      balance: '0.01912343',
      usdValue: '$10,234.23',
      change24h: isPositive ? 0.1 : -0.1,
      change24hAmount: isPositive ? '0,10%' : '-0,10%',
      priceUSD: '1800.00',
      chainId: 'ethereum', // Default to Ethereum if asset not found
      address: 'native',
      decimals: 18,
      chartData: {
        '1D': generateChartData(24, isPositive ? 'up' : 'down'),
        '1W': generateChartData(7, isPositive ? 'up' : 'down'),
        '1M': generateChartData(30, isPositive ? 'up' : 'down'),
        '1Y': generateChartData(12, isPositive ? 'up' : 'down'),
        '5Y': generateChartData(60, isPositive ? 'up' : 'down'),
        'All': generateChartData(100, isPositive ? 'up' : 'down'),
      },
      activities: [],
    };
  }

  // Use the portfolio asset data
  const isPositive = portfolioAsset.change24h > 0;
  const basePrice = 10000;
  const variation = isPositive ? Math.abs(portfolioAsset.change24h) / 100 : -Math.abs(portfolioAsset.change24h) / 100;

  const generateChartData = (points: number, trend: 'up' | 'down'): ChartDataPoint[] => {
    const data: ChartDataPoint[] = [];
    const now = Date.now();
    const interval = 86400000 / points;

    for (let i = 0; i < points; i++) {
      const timestamp = now - (points - i) * interval;
      const noise = (Math.random() - 0.5) * 0.02;
      const trendValue = trend === 'up'
        ? basePrice * (1 + (i / points) * variation + noise)
        : basePrice * (1 - (i / points) * Math.abs(variation) + noise);

      data.push({
        timestamp,
        value: Math.max(trendValue, basePrice * 0.9),
      });
    }

    return data;
  };

  // Generate only 3 recent activities for the detail page
  // (getAllAssetActivities will return all activities)
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const activities: AssetActivity[] = [
    {
      id: '1',
      type: 'sent',
      amount: `0,017 ${portfolioAsset.symbol}`,
      usdValue: '$725.00',
      timestamp: now - (2 * oneDay),
      date: formatDate(new Date(now - (2 * oneDay))),
    },
    {
      id: '2',
      type: 'received',
      amount: `0,025 ${portfolioAsset.symbol}`,
      usdValue: '$1,050.00',
      timestamp: now - (5 * oneDay),
      date: formatDate(new Date(now - (5 * oneDay))),
    },
    {
      id: '3',
      type: 'swap',
      amount: `0,050 ${portfolioAsset.symbol}`,
      usdValue: '$2,100.00',
      timestamp: now - (8 * oneDay),
      date: formatDate(new Date(now - (8 * oneDay))),
    },
  ];

  // Format change24h amount
  const change24hAmount = isPositive
    ? `+${portfolioAsset.change24h.toFixed(2)}%`
    : `${portfolioAsset.change24h.toFixed(2)}%`;

  return {
    id: portfolioAsset.id,
    symbol: portfolioAsset.symbol,
    name: portfolioAsset.name,
    logo: portfolioAsset.logo,
    balance: portfolioAsset.balance,
    usdValue: portfolioAsset.usdValue,
    priceUSD: portfolioAsset.usdValue.replace('$', '').replace(',', ''),
    change24h: portfolioAsset.change24h / 100, // Convert percentage to decimal
    change24hAmount: change24hAmount,
    chainId: portfolioAsset.chainId, // Preserve chain information from portfolio
    address: portfolioAsset.address,
    decimals: portfolioAsset.decimals,
    chartData: {
      '1D': generateChartData(24, isPositive ? 'up' : 'down'),
      '1W': generateChartData(7, isPositive ? 'up' : 'down'),
      '1M': generateChartData(30, isPositive ? 'up' : 'down'),
      '1Y': generateChartData(12, isPositive ? 'up' : 'down'),
      '5Y': generateChartData(60, isPositive ? 'up' : 'down'),
      'All': generateChartData(100, isPositive ? 'up' : 'down'),
    },
    activities,
  };
};


