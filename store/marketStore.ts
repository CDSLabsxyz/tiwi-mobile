import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
const TWC_CHAIN_ID = 56; // BNB Chain
const TWC_ID = `${TWC_CHAIN_ID}-${TWC_ADDRESS.toLowerCase()}`;

export const TWC_TOKEN: FavoriteToken = {
    id: TWC_ID,
    symbol: 'TWC',
    name: 'TIWI CAT',
    address: TWC_ADDRESS,
    chainId: TWC_CHAIN_ID,
    logoURI: 'https://cdn.dexscreener.com/cms/images/c135d9cc87d8db4c1e74788c546ed3c7c4498a5da693cbefdc30e749cbea4843?width=800&height=800&quality=90',
    priceUSD: '0',
    priceChange24h: 0,
};

export interface FavoriteToken {
    id: string;
    symbol: string;
    name: string;
    address?: string;
    chainId?: number;
    logoURI?: string;
    priceUSD?: string;
    priceChange24h?: number;
}

interface MarketState {
    favorites: string[];
    favoriteTokens: FavoriteToken[];
    toggleFavorite: (tokenId: string, tokenData?: FavoriteToken) => void;
    isFavorite: (tokenId: string) => boolean;
    getFavoriteTokens: () => FavoriteToken[];
}

export const useMarketStore = create<MarketState>()(
    persist(
        (set, get) => ({
            favorites: [TWC_ID],
            favoriteTokens: [TWC_TOKEN],

            toggleFavorite: (tokenId: string, tokenData?: FavoriteToken) => {
                if (!tokenId) return;
                const { favorites, favoriteTokens } = get();
                const lowerTokenId = tokenId.toLowerCase();

                if (favorites.some(id => id?.toLowerCase() === lowerTokenId)) {
                    set({
                        favorites: favorites.filter(id => id?.toLowerCase() !== lowerTokenId),
                        favoriteTokens: favoriteTokens.filter(t => t.id.toLowerCase() !== lowerTokenId),
                    });
                } else {
                    set({
                        favorites: [...favorites, lowerTokenId],
                        favoriteTokens: tokenData
                            ? [...favoriteTokens, { ...tokenData, id: lowerTokenId }]
                            : favoriteTokens,
                    });
                }
            },

            isFavorite: (tokenId: string) => {
                if (!tokenId || !get().favorites) return false;
                return get().favorites.some(id => id?.toLowerCase() === tokenId.toLowerCase());
            },

            getFavoriteTokens: () => {
                const tokens = get().favoriteTokens;
                // Always ensure TWC is first
                const twc = tokens.find(t => t.symbol === 'TWC') || TWC_TOKEN;
                const rest = tokens.filter(t => t.symbol !== 'TWC');
                return [twc, ...rest];
            },
        }),
        {
            name: 'tiwi-market-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
