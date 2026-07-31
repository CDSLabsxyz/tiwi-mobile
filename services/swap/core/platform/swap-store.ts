/**
 * Swap-store bridge.
 *
 * The copied executors read exactly ONE thing off the web's Zustand swap store:
 * `selectedGasTokenType` — the BSC relayer's gas-token tier, which sets the tax
 * rate (TWC 0.20% / BNB 0.25% / other BEP-20 0.30%) and which relayer path runs.
 *
 * Rather than fork every executor, this module exposes a `useSwapStore`-shaped
 * object backed by the mobile store, so `useSwapStore.getState().selectedGasTokenType`
 * keeps working unchanged.
 */

import { useSwapStore as useMobileSwapStore } from '@/store/swapStore';
import { GasTokenType } from '@/services/swap/core/config/tax-config';

export interface SwapStoreShim {
    selectedGasTokenType: GasTokenType;
    selectedGasToken: any | null;
}

export const useSwapStore = {
    getState(): SwapStoreShim {
        const state = useMobileSwapStore.getState() as any;
        return {
            selectedGasTokenType: state.selectedGasTokenType ?? GasTokenType.BNB,
            selectedGasToken: state.selectedGasToken ?? null,
        };
    },
};

export { GasTokenType };
