/**
 * Wallet Service
 * Simulates API calls to fetch wallet data from backend
 * Production-ready structure with chain tracking
 */

import type { ChainId } from "@/components/sections/Swap/ChainSelectSheet";
import { api, WalletBalanceResponse } from "@/lib/mobile/api-client";
import { moralisService } from "@/services/moralisService";
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
 * Fetches wallet data from backend API using the new Mobile SDK
 */
export const fetchWalletData = async (address: string): Promise<WalletData> => {
  try {
    // 1. Fetch real balances using the new SDK
    const balanceResponse = await api.wallet.balances({ address });

    // 2. Map SDK response to existing PortfolioItem format (API returns flat WalletToken[])
    const portfolio: PortfolioItem[] = balanceResponse.balances.map((b, i) => ({
      id: `${b.chainId}-${b.address || i}`,
      symbol: b.symbol,
      name: b.name,
      logo: b.logoURI || 'https://via.placeholder.com/100?text=Token',
      balance: b.balanceFormatted || b.balance,
      usdValue: `$${parseFloat(b.usdValue || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change24h: parseFloat(b.priceChange24h || '0'),
      chainId: b.chainId as any,
      address: b.address,
      decimals: b.decimals || 18,
      chartData: 'https://www.figma.com/api/mcp/asset/a34680f1-9f3f-432d-9c1d-762d12a6bd6b',
    }));

    // 3. Optional: Fetch transaction history for unified activity
    let activities: Activity[] = [];
    try {
      const history = await api.wallet.transactions({ address, limit: 10 });
      if (history && history.transactions) {
        activities = history.transactions.map((tx: any) => ({
          id: tx.id,
          type: tx.type?.toLowerCase() || 'transfer',
          token: tx.tokenSymbol,
          amount: tx.amountFormatted,
          timestamp: tx.timestamp,
          status: tx.status || 'completed',
        }));
      }
    } catch (e) {
      console.warn("Transactions fetch failed:", e);
    }

    return {
      address,
      totalBalance: `$${parseFloat(balanceResponse.totalUSD || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      usdBalance: parseFloat(balanceResponse.totalUSD || '0'),
      portfolioChange: {
        amount: '+0.00',
        percent: '0.00%',
        period: 'today',
      },
      claimableRewards: '$0.00',
      portfolio,
      activities: activities.slice(0, 5),
      transactionHistory: [], // Populated by fetchTransactionHistory
    };
  } catch (error) {
    console.error("fetchWalletData failed:", error);
    // Fallback to minimal empty state
    return {
      address,
      totalBalance: '$0.00',
      usdBalance: 0,
      portfolioChange: { amount: '0.00', percent: '0.00%', period: 'today' },
      claimableRewards: '$0.00',
      portfolio: [],
      activities: [],
      transactionHistory: [],
    };
  }
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
    const response = await api.nfts.list({ address });
    const apiNfts = response.nfts || [];

    // Normalize and handle missing data
    return apiNfts.map(nft => {
      const id = `${nft.contractAddress}-${nft.tokenId}`;
      return {
        id,
        name: nft.name || 'Unnamed NFT',
        mediaUrl: nft.imageThumbnail || nft.image || 'https://via.placeholder.com/400?text=No+Image',
        floorPrice: nft.floorPriceUSD ? `$${parseFloat(nft.floorPriceUSD).toLocaleString()}` : '0 ETH',
        collectionName: nft.collectionName,
        chainId: nft.chainId,
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId
      };
    });
  } catch (error: any) {
    // 404 = NFT API endpoint not yet deployed; fall back silently
    const is404 = error?.message?.includes('404') || error?.status === 404;
    if (is404) {
      console.warn('[fetchNFTs] NFT API not available (404), using placeholder data.');
    } else {
      console.warn('[fetchNFTs] Failed to fetch NFTs, using placeholder data:', error?.message);
    }
    // Skip artificial delay on known API unavailability
    if (!is404) await delay(600);
    return [];
  }
};

/**
 * Fetches detailed NFT information by ID from actual API
 */
export const fetchNFTDetail = async (nftId: string): Promise<NFTDetail> => {
  try {
    const [contractAddress, tokenId, walletAddress] = nftId.split('-');
    const apiDetail = await api.nfts.get(walletAddress || '', contractAddress || nftId, tokenId || '');

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
      isVerified: !!apiDetail.verified,
      description: apiDetail.description,
      collectionName: apiDetail.collectionName,
      activities: (apiDetail.activities || []).map((act: any) => ({
        id: act.id,
        type: act.type as any,
        nftName: act.nftName,
        amount: act.amount,
        timestamp: act.timestamp,
        date: act.date
      }))
    };
  } catch (error: any) {
    const is404 = error?.message?.includes('404') || error?.status === 404;
    if (is404) {
      console.warn('[fetchNFTDetail] NFT detail API not available (404), using placeholder data.');
    } else {
      console.warn('[fetchNFTDetail] Failed to fetch NFT detail, using placeholder data:', error?.message);
    }
    if (!is404) await delay(600);
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
export const getAllAssetActivities = async (assetId: string, symbolOverride?: string): Promise<AssetActivity[]> => {
  try {
    // Get the asset detail to use the correct symbol
    const assetDetail = await fetchAssetDetail(assetId);
    const symbol = assetDetail.symbol.toUpperCase();

    // Fetch real transaction history from API
    // We expect the address to be passed or derived somehow. 
    // Let's add it to the function parameters.
    const activeAddress = useWalletStore.getState().address;
    if (!activeAddress) throw new Error("No active wallet");

    const response = await api.wallet.transactions({
      address: activeAddress,
      limit: 50,
    });

    const formatDate = (timestamp: number): string => {
      const date = new Date(timestamp);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    // Filter by token symbol or address and map to AssetActivity interface
    const filteredActivities: AssetActivity[] = response.transactions
      .filter((tx: any) => {
        const txSymbol = (tx.tokenSymbol || '').toUpperCase();
        const txAddress = (tx.tokenAddress || '').toLowerCase();
        const searchAddr = assetId.toLowerCase();

        return txSymbol === symbol ||
          txAddress === searchAddr ||
          (symbol === 'ETH' && !txAddress); // Handle native ETH edge case
      })
      .map((tx: any) => ({
        id: tx.id,
        type: tx.type?.toLowerCase() as any || 'swap',
        amount: `${formatTokenAmount(tx.amountFormatted || '0')} ${tx.tokenSymbol || symbol}`,
        usdValue: tx.usdValue || '$0.00',
        usdAmount: parseFloat((tx.usdValue || '0').replace(/[$,]/g, '')),
        timestamp: tx.timestamp,
        date: formatDate(tx.timestamp),
      }));

    return filteredActivities;
  } catch (error) {
    console.warn("Failed to fetch real activities from primary backend, trying Moralis fallback...", error);

    try {
      const activeAddress = useWalletStore.getState().address;
      if (!activeAddress) return [];

      const history = await moralisService.getWalletHistory(activeAddress, [1, 56, 137, 42161, 8453, 10]);
      const symbol = symbolOverride?.toUpperCase();

      return history
        .filter((tx: any) => {
          const txSymbol = (tx.tokenSymbol || '').toUpperCase();
          const txAddress = (tx.tokenAddress || '').toLowerCase();
          const searchAddr = assetId.toLowerCase();

          return (symbol && txSymbol === symbol) ||
            txAddress === searchAddr ||
            (symbol === 'ETH' && (!txAddress || txAddress === 'native' || txAddress === '0x0000000000000000000000000000000000000000'));
        })
        .map((tx: any) => ({
          id: tx.id || tx.hash,
          type: tx.type,
          amount: `${tx.amountFormatted} ${tx.tokenSymbol || symbol || ''}`,
          usdValue: tx.usdValue,
          timestamp: tx.timestamp,
          date: new Date(tx.timestamp).toLocaleDateString(),
        }));
    } catch (fallbackError) {
      console.error("Moralis history fallback also failed:", fallbackError);
      return [];
    }
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

const generateChartData = (points: number, trend: 'up' | 'down', basePrice: number, variation: number): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const now = Date.now();
  const interval = 86400000 / points;

  for (let i = 0; i < points; i++) {
    const timestamp = now - (points - i) * interval;
    const noise = (Math.random() - 0.5) * 0.05;
    const trendValue = trend === 'up'
      ? basePrice * (1 + (i / points) * variation + noise)
      : basePrice * (1 - (i / points) * Math.abs(variation) + noise);

    data.push({
      timestamp,
      value: Math.max(trendValue, basePrice * 0.5),
    });
  }

  return data;
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

  // If asset not found in portfolio, try to get real data from the cache or API
  if (!portfolioAsset) {
    try {
      console.log(`[fetchAssetDetail] Asset ${assetId} not in mock portfolio. Fetching real data...`);

      // Use current address
      const activeAddress = useWalletStore.getState().address;
      if (activeAddress) {
        // Parse address from chainId-address format if needed
        const searchAddr = assetId.includes('-') ? assetId.split('-')[1].toLowerCase() : assetId.toLowerCase();

        // Fetch all balances to find this specific one (most robust way)
        const resp = await api.wallet.balances({ address: activeAddress }) as any;
        const balances = Array.isArray(resp?.balances) ? resp.balances : (Array.isArray(resp) ? resp : []);

        const realAsset = balances.find((b: any) =>
          b.address?.toLowerCase() === searchAddr ||
          (searchAddr === 'native' && (b.address?.toLowerCase() === '0x0000000000000000000000000000000000000000' || !b.address))
        );

        if (realAsset) {
          const chg24h = parseFloat(realAsset.priceChange24h || '0');
          const isPositive = chg24h >= 0;
          const activities = await getAllAssetActivities(assetId, realAsset.symbol);
          const price = parseFloat(realAsset.priceUSD || '0') || 1;
          const variation = Math.abs(chg24h) / 100;

          return {
            id: assetId,
            symbol: realAsset.symbol,
            name: realAsset.name,
            logo: realAsset.logoURI || realAsset.logo,
            balance: realAsset.balanceFormatted || realAsset.balance,
            usdValue: `$${parseFloat(realAsset.usdValue || '0').toFixed(2)}`,
            priceUSD: price.toString(),
            change24h: chg24h / 100,
            change24hAmount: `${isPositive ? '+' : ''}${chg24h.toFixed(2)}%`,
            chainId: realAsset.chainId as any,
            address: realAsset.address,
            decimals: realAsset.decimals || 18,
            chartData: {
              '1D': generateChartData(48, isPositive ? 'up' : 'down', price, variation),
              '1W': generateChartData(70, isPositive ? 'up' : 'down', price, variation * 2),
              '1M': generateChartData(100, isPositive ? 'up' : 'down', price, variation * 4),
              '1Y': generateChartData(150, isPositive ? 'up' : 'down', price, variation * 10),
              '5Y': generateChartData(200, isPositive ? 'up' : 'down', price, variation * 20),
              'All': generateChartData(250, isPositive ? 'up' : 'down', price, variation * 30),
            },
            activities: activities,
          };
        }
      }
    } catch (e) {
      console.error("[fetchAssetDetail] Failed to fetch real asset detail:", e);
    }

    // FINAL FALLBACK: Mock ETH
    return {
      id: assetId,
      symbol: 'ETH',
      name: 'Ethereum',
      logo: 'https://www.figma.com/api/mcp/asset/142d5172-a920-40ef-a06c-8e381f587e81',
      balance: '0.00',
      usdValue: '$0.00',
      change24h: 0,
      change24hAmount: '0.00%',
      priceUSD: '1800.00',
      chainId: 'ethereum',
      address: 'native',
      decimals: 18,
      chartData: {
        '1D': generateChartData(48, 'up', 1800, 0.02),
        '1W': generateChartData(70, 'up', 1800, 0.05),
        '1M': generateChartData(100, 'up', 1800, 0.1),
        '1Y': generateChartData(150, 'up', 1800, 0.2),
        '5Y': generateChartData(200, 'up', 1800, 0.5),
        'All': generateChartData(250, 'up', 1800, 0.8),
      },
      activities: [],
    };
  }

  // Use the portfolio asset data
  const isPositive = portfolioAsset.change24h > 0;
  const basePrice = parseFloat((portfolioAsset.usdValue || '0').replace(/[$,]/g, '')) || 10000;
  const variation = Math.abs(portfolioAsset.change24h) / 100;
  const activities = await getAllAssetActivities(portfolioAsset.id, portfolioAsset.symbol);

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
    priceUSD: basePrice.toString(),
    change24h: portfolioAsset.change24h / 100, // Convert percentage to decimal
    change24hAmount: change24hAmount,
    chainId: portfolioAsset.chainId, // Preserve chain information from portfolio
    address: portfolioAsset.address,
    decimals: portfolioAsset.decimals,
    chartData: {
      '1D': generateChartData(48, isPositive ? 'up' : 'down', basePrice, variation),
      '1W': generateChartData(70, isPositive ? 'up' : 'down', basePrice, variation * 2),
      '1M': generateChartData(100, isPositive ? 'up' : 'down', basePrice, variation * 4),
      '1Y': generateChartData(150, isPositive ? 'up' : 'down', basePrice, variation * 10),
      '5Y': generateChartData(200, isPositive ? 'up' : 'down', basePrice, variation * 20),
      'All': generateChartData(250, isPositive ? 'up' : 'down', basePrice, variation * 30),
    },
    activities,
  };
};


