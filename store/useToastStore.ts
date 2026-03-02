import { create } from 'zustand';

export type ToastStatus = 'pending' | 'confirmed' | 'success' | 'error';

interface ToastState {
    visible: boolean;
    message: string;
    status: ToastStatus;
    txHash?: string;
    showToast: (message: string, status: ToastStatus, txHash?: string, duration?: number) => void;
    hideToast: () => void;
}

let toastTimeout: NodeJS.Timeout | null = null;

export const useToastStore = create<ToastState>((set) => ({
    visible: false,
    message: '',
    status: 'pending',
    txHash: undefined,
    showToast: (message, status, txHash, duration = 3000) => {
        // Clear any existing timeout
        if (toastTimeout) clearTimeout(toastTimeout);

        set({ visible: true, message, status, txHash });

        // Auto hide after duration if status is not pending
        if (status !== 'pending' && status !== 'confirmed') {
            toastTimeout = setTimeout(() => {
                set({ visible: false });
            }, duration);
        }
    },
    hideToast: () => {
        if (toastTimeout) clearTimeout(toastTimeout);
        set({ visible: false });
    },
}));
