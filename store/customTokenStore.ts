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
    // When true, the token is kept in the user's manage-tokens list but
    // hidden from the wallet asset view. Lets the user toggle individual
    // tokens off without losing the entry.
    hidden?: boolean;
}

interface HiddenRef {
    address: string;
    chainId: number;
}

interface CustomTokenState {
    // Tokens scoped per wallet group ID
    tokensByWallet: Record<string, CustomToken[]>;
    // Wallet-fetched tokens the user has toggled off in manage-tokens.
    // Keyed per wallet group ID, matched by (address, chainId).
    hiddenWalletTokens: Record<string, HiddenRef[]>;
    addToken: (walletId: string, token: CustomToken) => void;
    removeToken: (walletId: string, address: string, chainId: number) => void;
    hasToken: (walletId: string, address: string, chainId: number) => boolean;
    getTokens: (walletId: string) => CustomToken[];
    updateTokenBalance: (walletId: string, address: string, chainId: number, updates: { balanceFormatted?: string; usdValue?: string; priceUSD?: string }) => void;
    toggleTokenHidden: (walletId: string, address: string, chainId: number) => void;
    toggleWalletTokenHidden: (walletId: string, address: string, chainId: number) => void;
    isWalletTokenHidden: (walletId: string, address: string, chainId: number) => boolean;
}

export const useCustomTokenStore = create<CustomTokenState>()(
    persist(
        (set, get) => ({
            tokensByWallet: {},
            hiddenWalletTokens: {},

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

            toggleTokenHidden: (walletId, address, chainId) => {
                set(state => {
                    const current = state.tokensByWallet[walletId] || [];
                    const updated = current.map(t => {
                        if (t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId) {
                            return { ...t, hidden: !t.hidden };
                        }
                        return t;
                    });
                    return {
                        tokensByWallet: {
                            ...state.tokensByWallet,
                            [walletId]: updated,
                        },
                    };
                });
            },

            toggleWalletTokenHidden: (walletId, address, chainId) => {
                set(state => {
                    const current = state.hiddenWalletTokens[walletId] || [];
                    const key = address.toLowerCase();
                    const exists = current.some(r => r.address.toLowerCase() === key && r.chainId === chainId);
                    const next = exists
                        ? current.filter(r => !(r.address.toLowerCase() === key && r.chainId === chainId))
                        : [...current, { address, chainId }];
                    return {
                        hiddenWalletTokens: {
                            ...state.hiddenWalletTokens,
                            [walletId]: next,
                        },
                    };
                });
            },

            isWalletTokenHidden: (walletId, address, chainId) => {
                const current = get().hiddenWalletTokens[walletId] || [];
                return current.some(
                    r => r.address.toLowerCase() === address.toLowerCase() && r.chainId === chainId
                );
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
