import { create } from 'zustand';

export type ToastStatus = 'pending' | 'confirmed' | 'success' | 'error';

interface ToastState {
    visible: boolean;
    message: string;
    status: ToastStatus;
    txHash?: string;
    showToast: (message: string, status: ToastStatus, txHash?: string) => void;
    hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
    visible: false,
    message: '',
    status: 'pending',
    txHash: undefined,
    showToast: (message, status, txHash) => set({ visible: true, message, status, txHash }),
    hideToast: () => set({ visible: false }),
}));
