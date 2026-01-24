import AsyncStorage from '@react-native-async-storage/async-storage';

const WALLETCONNECT_PROJECT_ID = '8e998cd112127e42dce5e2bf74122539';
const EXPLORER_API_BASE = 'https://explorer-api.walletconnect.com/v3';
const CACHE_KEY = '@tiwi_wallet_listings_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export interface WalletConnectWallet {
  id: string;
  name: string;
  homepage: string;
  image_id: string;
  app: {
    browser?: string;
    ios?: string;
    android?: string;
    desktop?: string;
  };
  mobile: {
    native: string;
    universal: string;
  };
}

interface WalletListingsResponse {
  listings: Record<string, WalletConnectWallet>;
  count: number;
}

interface CachedData {
  timestamp: number;
  wallets: WalletConnectWallet[];
}

// Default popular wallets to prioritize
export const POPULAR_WALLETS = [
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
  '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
  '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget
  'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase
  'a797aa35c0fadbfc1a53e7f675162ed522696a2546df5d78f8e229d2b519d0e3', // Phantom
];

let inMemoryCache: WalletConnectWallet[] | null = null;

/**
 * Prefetches wallet listings and stores in cache
 * Should be called early in app lifecycle
 */
export const prefetchWallets = async (): Promise<void> => {
  // First try to load from disk to populate memory cache
  try {
    const cachedString = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedString) {
      const cachedData: CachedData = JSON.parse(cachedString);
      inMemoryCache = cachedData.wallets;
      
      // If cache is fresh, stop here (optional, currently we refresh in background)
      const isFresh = (Date.now() - cachedData.timestamp) < CACHE_EXPIRY;
      if (isFresh && inMemoryCache.length > 0) return;
    }
  } catch (e) {
    console.warn('Failed to load wallet cache', e);
  }

  // Fetch fresh data
  try {
    // Requesting 100 entries as requested to show a large but manageable list
    const response = await fetch(
      `${EXPLORER_API_BASE}/wallets?projectId=${WALLETCONNECT_PROJECT_ID}&entries=100`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch wallets');
    }

    const data: WalletListingsResponse = await response.json();
    const wallets = Object.values(data.listings);
    
    // Update caches
    inMemoryCache = wallets;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      wallets
    }));
  } catch (error) {
    console.error('Error prefetching wallets:', error);
  }
};

export const fetchWalletListings = async (): Promise<WalletConnectWallet[]> => {
  // Return memory cache immediately if available
  if (inMemoryCache) {
    // If we have cache, we return it but trigger a background refresh if it might be stale?
    // For simplicity, just return it. The prefetch handles the initial load/refresh.
    if (inMemoryCache.length === 0) {
        // If empty cache but initialized, try fetching
        await prefetchWallets();
    }
    return inMemoryCache || [];
  }

  // If no memory cache, try disk -> network (via prefetch logic)
  await prefetchWallets();
  return inMemoryCache || [];
};

export const getWalletIconUrl = (imageId: string): string => {
  return `${EXPLORER_API_BASE}/logo/md/${imageId}?projectId=${WALLETCONNECT_PROJECT_ID}`;
};