/**
 * Swap store - manages all swap-related state
 * Migrated from useState hooks in swap.tsx to Zustand for better state management
 */

import { create } from "zustand";
import type { ChainOption } from "@/components/sections/Swap/ChainSelectSheet";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";
import type { SwapTabKey } from "@/components/sections/Swap/SwapTabs";
import type { ExpiresOption } from "@/components/sections/Swap/ExpiresSection";

// Default FROM token (TWC) - ensures fromToken is never null
const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
const defaultFromToken: TokenOption = {
  id: "twc",
  symbol: "TWC",
  name: "TWC",
  icon: require("@/assets/home/tiwicat-token.svg"),
  tvl: "$1,000,000",
  balanceFiat: "$0",
  balanceToken: "0 TWC",
  address: TWC_ADDRESS,
  chainId: 1,
  decimals: 9,
};

export interface SwapQuoteDetails {
  gasFee: string;
  slippage: string;
  twcFee: string;
  source: string[];
}

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
  swapQuote: SwapQuoteDetails | null;
  toFiatAmount: string;

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
  setSwapQuote: (quote: SwapQuoteDetails | null) => void;
  setToFiatAmount: (amount: string) => void;

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
  fromChain: { id: 'ethereum', name: "Ethereum", icon: require("@/assets/home/chains/ethereum.svg") },
  fromToken: defaultFromToken,
  toChain: null,
  toToken: null,
  whenPrice: "",
  whenPriceToken: null,
  expiresOption: "never",
  isChainSheetVisible: false,
  isTokenSheetVisible: false,
  chainSheetTarget: "from",
  tokenSheetTarget: "from",
  swapQuote: null,
  toFiatAmount: "$0",

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

  // Actions - Complex operations
  swapDirection: () => {
    const state = get();
    set({
      fromAmount: state.toAmount,
      toAmount: state.fromAmount,
      fromChain: state.toChain,
      fromToken: state.toToken || defaultFromToken,
      toChain: state.fromChain,
      toToken: state.fromToken,
    });
  },
  resetSwapState: () => set({
    fromAmount: "",
    toAmount: "",
    fromChain: null,
    fromToken: defaultFromToken,
    toChain: null,
    toToken: null,
    whenPrice: "",
    whenPriceToken: null,
    expiresOption: "never",
    swapQuote: null,
    toFiatAmount: "$0",
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

