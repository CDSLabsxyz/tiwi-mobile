/**
 * Swap store - manages all swap-related state
 * Migrated from useState hooks in swap.tsx to Zustand for better state management
 */

import type { ChainOption } from "@/components/sections/Swap/ChainSelectSheet";
import type { ExpiresOption } from "@/components/sections/Swap/ExpiresSection";
import type { SwapTabKey } from "@/components/sections/Swap/SwapTabs";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import type { SwapQuote } from "@/services/swap/types";
import { create } from "zustand";

const DEFAULT_BNB_TOKEN: TokenOption = {
  address: "0x0000000000000000000000000000000000000000",
  chainId: 56,
  decimals: 18,
  icon: "https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png?1547034615",
  id: "bnb-native",
  name: "BNB",
  priceUSD: "619.87",
  symbol: "BNB",
  tvl: "$0",
  balanceFiat: "$0.00",
  balanceToken: "0.00 BNB",
};

const DEFAULT_TWC_TOKEN: TokenOption = {
  address: "0xDA1060158F7D593667cCE0a15DB346BB3FfB3596",
  chainId: 56,
  decimals: 9,
  icon: "https://cdn.dexscreener.com/cms/images/c135d9cc87d8db4c1e74788c546ed3c7c4498a5da693cbefdc30e749cbea4843?width=800&height=800&quality=90",
  id: "twc-native",
  name: "TIWI CAT",
  priceUSD: "0.0000000003498",
  symbol: "TWC",
  tvl: "$317,309",
  balanceFiat: "$0.00",
  balanceToken: "0.00 TWC",
};

const DEFAULT_BNB_CHAIN: ChainOption = {
  id: 56,
  name: "BNB Chain",
  icon: undefined // Will be updated by chains hook
};

type SheetTarget = "from" | "to" | "whenPrice";

interface SwapState {
  // Form state
  activeTab: SwapTabKey;
  fromAmount: string;
  toAmount: string;
  fromChain: ChainOption | null;
  fromToken: TokenOption;
  toChain: ChainOption | null;
  toToken: TokenOption | null;

  // Limit order state
  whenPrice: string;
  whenPriceToken: TokenOption | null;
  expiresOption: ExpiresOption;

  // UI state
  isChainSheetVisible: boolean;
  isTokenSheetVisible: boolean;
  chainSheetTarget: SheetTarget;
  tokenSheetTarget: SheetTarget;

  // Quote state
  swapQuote: SwapQuote | null;
  toFiatAmount: string;

  // Settings state
  slippage: number;
  useRelayer: boolean;
  gasPaymentToken: TokenOption | null;

  // Actions - Form
  setActiveTab: (tab: SwapTabKey) => void;
  setFromAmount: (amount: string) => void;
  setToAmount: (amount: string) => void;
  setFromChain: (chain: ChainOption | null) => void;
  setFromToken: (token: TokenOption) => void;
  setToChain: (chain: ChainOption | null) => void;
  setToToken: (token: TokenOption | null) => void;

  // Actions - Limit order
  setWhenPrice: (price: string) => void;
  setWhenPriceToken: (token: TokenOption | null) => void;
  setExpiresOption: (option: ExpiresOption) => void;

  // Actions - UI
  openChainSheet: (target: SheetTarget) => void;
  closeChainSheet: () => void;
  openTokenSheet: (target: SheetTarget) => void;
  closeTokenSheet: () => void;

  // Actions - Quote
  setSwapQuote: (quote: SwapQuote | null) => void;
  setToFiatAmount: (amount: string) => void;

  // Actions - Settings
  setSlippage: (slippage: number) => void;
  setUseRelayer: (useRelayer: boolean) => void;
  setGasPaymentToken: (token: TokenOption | null) => void;

  // Actions - Complex operations
  swapDirection: () => void;
  resetSwapState: () => void;

  // Computed selectors
  isFormValid: () => boolean;
  hasValidQuote: () => boolean;
}

/**
 * Swap store - centralizes all swap-related state management
 */
export const useSwapStore = create<SwapState>((set, get) => ({
  // Initial state
  activeTab: "swap",
  fromAmount: "",
  toAmount: "",
  fromChain: DEFAULT_BNB_CHAIN,
  fromToken: DEFAULT_BNB_TOKEN,
  toChain: DEFAULT_BNB_CHAIN,
  toToken: DEFAULT_TWC_TOKEN,
  whenPrice: "",
  whenPriceToken: null,
  expiresOption: "never",
  isChainSheetVisible: false,
  isTokenSheetVisible: false,
  chainSheetTarget: "from",
  tokenSheetTarget: "from",
  swapQuote: null,
  toFiatAmount: "$0",

  // Settings implementation
  slippage: 3.0,
  useRelayer: false,
  gasPaymentToken: null,

  // Actions - Form
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFromAmount: (amount) => set({ fromAmount: amount }),
  setToAmount: (amount) => set({ toAmount: amount }),
  setFromChain: (chain) => set({ fromChain: chain }),
  setFromToken: (token) => set({ fromToken: token }),
  setToChain: (chain) => set({ toChain: chain }),
  setToToken: (token) => set({ toToken: token }),

  // Actions - Limit order
  setWhenPrice: (price) => set({ whenPrice: price }),
  setWhenPriceToken: (token) => set({ whenPriceToken: token }),
  setExpiresOption: (option) => set({ expiresOption: option }),

  // Actions - UI
  openChainSheet: (target) => set({
    isChainSheetVisible: true,
    chainSheetTarget: target,
    tokenSheetTarget: target, // Set both for consistency
  }),
  closeChainSheet: () => set({ isChainSheetVisible: false }),
  openTokenSheet: (target) => set({
    isTokenSheetVisible: true,
    tokenSheetTarget: target,
  }),
  closeTokenSheet: () => set({ isTokenSheetVisible: false }),

  // Actions - Quote
  setSwapQuote: (quote) => set({ swapQuote: quote }),
  setToFiatAmount: (amount) => set({ toFiatAmount: amount }),

  // Actions - Settings implementation
  setSlippage: (slippage) => set({ slippage }),
  setUseRelayer: (useRelayer) => set({ useRelayer }),
  setGasPaymentToken: (token) => set({ gasPaymentToken: token }),

  // Actions - Complex operations
  swapDirection: () => {
    const state = get();
    set({
      fromAmount: state.toAmount,
      toAmount: state.fromAmount,
      fromChain: state.toChain,
      fromToken: state.toToken || DEFAULT_TWC_TOKEN,
      toChain: state.fromChain,
      toToken: state.fromToken,
    });
  },
  resetSwapState: () => set({
    fromAmount: "",
    toAmount: "",
    fromChain: DEFAULT_BNB_CHAIN,
    fromToken: DEFAULT_BNB_TOKEN,
    toChain: DEFAULT_BNB_CHAIN,
    toToken: DEFAULT_TWC_TOKEN,
    whenPrice: "",
    whenPriceToken: null,
    expiresOption: "never",
    swapQuote: null,
    toFiatAmount: "$0",
    slippage: 0.5,
    useRelayer: false,
    gasPaymentToken: null,
  }),

  // Computed selectors
  isFormValid: () => {
    const state = get();
    const fromValue = parseFloat(state.fromAmount);
    const toValue = parseFloat(state.toAmount);

    if (state.activeTab === "swap") {
      return (
        !Number.isNaN(fromValue) &&
        fromValue > 0 &&
        !Number.isNaN(toValue) &&
        toValue > 0 &&
        !!state.fromToken &&
        !!state.fromChain &&
        !!state.toToken &&
        !!state.toChain
      );
    } else {
      // Limit tab validation
      const whenPriceValue = parseFloat(state.whenPrice);
      return (
        !Number.isNaN(fromValue) &&
        fromValue > 0 &&
        !Number.isNaN(toValue) &&
        toValue > 0 &&
        !Number.isNaN(whenPriceValue) &&
        whenPriceValue > 0 &&
        !!state.fromToken &&
        !!state.fromChain &&
        !!state.toToken &&
        !!state.toChain &&
        !!state.whenPriceToken
      );
    }
  },
  hasValidQuote: () => {
    const state = get();
    return !!state.swapQuote && parseFloat(state.toAmount) > 0;
  },
}));

