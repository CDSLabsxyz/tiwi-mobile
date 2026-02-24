import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
const TWC_CHAIN_ID = 56; // BNB Chain
const TWC_ID = `${TWC_CHAIN_ID}-${TWC_ADDRESS.toLowerCase()}`;

interface MarketState {
    favorites: string[]; // array of chainId-address
    toggleFavorite: (tokenId: string) => void;
    isFavorite: (tokenId: string) => boolean;
}

export const useMarketStore = create<MarketState>()(
    persist(
        (set, get) => ({
            favorites: [TWC_ID], // Initialize with TWC by default

            toggleFavorite: (tokenId: string) => {
                if (!tokenId) return;
                const { favorites } = get();
                const lowerTokenId = tokenId.toLowerCase();

                if (favorites.includes(lowerTokenId)) {
                    set({ favorites: favorites.filter(id => id?.toLowerCase() !== lowerTokenId) });
                } else {
                    set({ favorites: [...favorites, lowerTokenId] });
                }
            },

            isFavorite: (tokenId: string) => {
                if (!tokenId || !get().favorites) return false;
                return get().favorites.some(id => id?.toLowerCase() === tokenId.toLowerCase());
            },
        }),
        {
            name: 'tiwi-market-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
