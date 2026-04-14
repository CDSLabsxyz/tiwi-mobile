import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CustomToken {
    address: string;
    chainId: number;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    priceUSD?: string;
    balanceFormatted?: string;
    usdValue?: string;
    addedAt: number;
}

interface CustomTokenState {
    // Tokens scoped per wallet group ID
    tokensByWallet: Record<string, CustomToken[]>;
    addToken: (walletId: string, token: CustomToken) => void;
    removeToken: (walletId: string, address: string, chainId: number) => void;
    hasToken: (walletId: string, address: string, chainId: number) => boolean;
    getTokens: (walletId: string) => CustomToken[];
    updateTokenBalance: (walletId: string, address: string, chainId: number, updates: { balanceFormatted?: string; usdValue?: string; priceUSD?: string }) => void;
}

export const useCustomTokenStore = create<CustomTokenState>()(
    persist(
        (set, get) => ({
            tokensByWallet: {},

            addToken: (walletId, token) => {
                const current = get().tokensByWallet[walletId] || [];
                const exists = current.some(
                    t => t.address.toLowerCase() === token.address.toLowerCase() && t.chainId === token.chainId
                );
                if (!exists) {
                    set(state => ({
                        tokensByWallet: {
                            ...state.tokensByWallet,
                            [walletId]: [...current, token],
                        },
                    }));
                }
            },

            removeToken: (walletId, address, chainId) => {
                set(state => {
                    const current = state.tokensByWallet[walletId] || [];
                    return {
                        tokensByWallet: {
                            ...state.tokensByWallet,
                            [walletId]: current.filter(
                                t => !(t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId)
                            ),
                        },
                    };
                });
            },

            hasToken: (walletId, address, chainId) => {
                const current = get().tokensByWallet[walletId] || [];
                return current.some(
                    t => t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId
                );
            },

            getTokens: (walletId) => {
                return get().tokensByWallet[walletId] || [];
            },

            updateTokenBalance: (walletId, address, chainId, updates) => {
                set(state => {
                    const current = state.tokensByWallet[walletId] || [];
                    const updated = current.map(t => {
                        if (t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId) {
                            return { ...t, ...updates };
                        }
                        return t;
                    });
                    // Only update if something actually changed
                    const hasChanged = updated.some((t, i) => {
                        const prev = current[i];
                        return t.balanceFormatted !== prev.balanceFormatted ||
                               t.usdValue !== prev.usdValue ||
                               t.priceUSD !== prev.priceUSD;
                    });
                    if (!hasChanged) return state;
                    return {
                        tokensByWallet: {
                            ...state.tokensByWallet,
                            [walletId]: updated,
                        },
                    };
                });
            },
        }),
        {
            name: 'tiwi-custom-tokens',
            storage: createJSONStorage(() => AsyncStorage),
            // Migrate old flat-array format to per-wallet format on first load
            migrate: (persistedState: any, _version: number) => {
                if (persistedState && Array.isArray(persistedState.tokens)) {
                    return {
                        tokensByWallet: {
                            _legacy: persistedState.tokens,
                        },
                    };
                }
                return persistedState;
            },
            version: 1,
        }
    )
);
