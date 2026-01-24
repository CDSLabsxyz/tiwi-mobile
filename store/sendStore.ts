/**
 * Send store - manages all send-related state
 * Similar to swap store, tracks token, amount, recipient, etc.
 */

import { create } from "zustand";
import type { ChainOption } from "@/components/sections/Swap/ChainSelectSheet";
import type { TokenOption } from "@/components/sections/Swap/TokenSelectSheet";

export type SendTab = "send-to-one" | "multi-send";

export interface SendRecipient {
  address: string;
  amount: string;
}

interface SendState {
  // Tab state
  activeTab: SendTab;

  // Token & Chain
  selectedToken: TokenOption | null;
  selectedChain: ChainOption | null;

  // Send to One state
  recipientAddress: string;
  amount: string;
  usdValue: string;

  // Multi-Send state
  recipients: SendRecipient[];
  amountPerRecipient: string;
  totalRecipients: number;

  // Transaction details
  networkFee: string;
  networkFeeUSD: string;

  // UI state
  isTokenSheetVisible: boolean;
  currentStep: "select-asset" | "enter-details" | "review" | "passcode";

  // Actions
  setActiveTab: (tab: SendTab) => void;
  setSelectedToken: (token: TokenOption | null) => void;
  setSelectedChain: (chain: ChainOption | null) => void;
  setRecipientAddress: (address: string) => void;
  setAmount: (amount: string) => void;
  setUsdValue: (value: string) => void;
  setRecipients: (recipients: SendRecipient[]) => void;
  setAmountPerRecipient: (amount: string) => void;
  setNetworkFee: (fee: string, feeUSD: string) => void;
  openTokenSheet: () => void;
  closeTokenSheet: () => void;
  setCurrentStep: (step: SendState["currentStep"]) => void;
  resetSendState: () => void;
  prePopulateFromAsset: (token: TokenOption, chain: ChainOption, balance: string, usdValue: string) => void;
}

const initialState = {
  activeTab: "send-to-one" as SendTab,
  selectedToken: null,
  selectedChain: null,
  recipientAddress: "",
  amount: "",
  usdValue: "$0.00",
  recipients: [],
  amountPerRecipient: "",
  totalRecipients: 0,
  networkFee: "0",
  networkFeeUSD: "$0.00",
  isTokenSheetVisible: false,
  currentStep: "select-asset" as const,
};

/**
 * Send store - centralizes all send-related state management
 */
export const useSendStore = create<SendState>((set, get) => ({
  ...initialState,

  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedToken: (token) => set({ selectedToken: token }),
  setSelectedChain: (chain) => set({ selectedChain: chain }),
  setRecipientAddress: (address) => set({ recipientAddress: address }),
  setAmount: (amount) => {
    set({ amount });
    // Calculate USD value (mock calculation)
    const numAmount = parseFloat(amount) || 0;
    const usdValue = numAmount * 1000; // Mock price
    set({ 
      usdValue: `$${usdValue.toFixed(2)}`,
      // Calculate network fee (mock: ~0.0000446 ETH or equivalent)
      networkFee: "0.0000446",
      networkFeeUSD: "$0.04460",
    });
  },
  setUsdValue: (value) => set({ usdValue: value }),
  setRecipients: (recipients) => {
    set({ 
      recipients,
      totalRecipients: recipients.length,
    });
  },
  setAmountPerRecipient: (amount) => set({ amountPerRecipient: amount }),
  setNetworkFee: (fee, feeUSD) => set({ networkFee: fee, networkFeeUSD: feeUSD }),
  openTokenSheet: () => set({ isTokenSheetVisible: true }),
  closeTokenSheet: () => set({ isTokenSheetVisible: false }),
  setCurrentStep: (step) => set({ currentStep: step }),
  resetSendState: () => set(initialState),
  prePopulateFromAsset: (token, chain, balance, usdValue) => {
    set({
      selectedToken: token,
      selectedChain: chain,
      amount: "",
      usdValue: "$0.00",
      networkFee: "0.0000446",
      networkFeeUSD: "$0.04460",
      currentStep: "enter-details", // Skip asset selection if pre-populated
    });
  },
}));

