import { create } from 'zustand';

export type DAppRequestKind =
    | 'connect'
    | 'personal_sign'
    | 'eth_sign'
    | 'signTypedData'
    | 'sendTransaction'
    | 'switchChain'
    | 'addChain'
    | 'watchAsset';

export interface DAppRequest {
    id: string;
    kind: DAppRequestKind;
    origin: string;
    method: string;
    params: any[];
    createdAt: number;
    resolve: (value: any) => void;
    reject: (reason: { code: number; message: string }) => void;
}

interface DAppRequestState {
    queue: DAppRequest[];
    current: DAppRequest | null;

    enqueue: (req: Omit<DAppRequest, 'id' | 'createdAt' | 'resolve' | 'reject'>) => Promise<any>;
    approve: (value: any) => void;
    reject: (reason?: { code: number; message: string }) => void;
}

let reqCounter = 0;

export const useDAppRequestStore = create<DAppRequestState>((set, get) => ({
    queue: [],
    current: null,

    enqueue: (partial) => {
        return new Promise((resolve, reject) => {
            const id = `req_${Date.now()}_${++reqCounter}`;
            const req: DAppRequest = {
                ...partial,
                id,
                createdAt: Date.now(),
                resolve,
                reject,
            };

            set((s) => {
                if (!s.current) {
                    return { current: req, queue: s.queue };
                }
                return { queue: [...s.queue, req] };
            });
        });
    },

    approve: (value) => {
        const { current, queue } = get();
        if (!current) return;
        try {
            current.resolve(value);
        } catch (e) {
            console.warn('[dappRequestStore] approve resolve failed', e);
        }
        const [next, ...rest] = queue;
        set({ current: next || null, queue: rest });
    },

    reject: (reason) => {
        const { current, queue } = get();
        if (!current) return;
        try {
            current.reject(reason || { code: 4001, message: 'User rejected the request' });
        } catch (e) {
            console.warn('[dappRequestStore] reject failed', e);
        }
        const [next, ...rest] = queue;
        set({ current: next || null, queue: rest });
    },
}));
