import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = '@tiwi/home-chains-';

const diskCache: Record<string, { data: any; updatedAt: number }> = {};
AsyncStorage.getAllKeys()
    .then(keys => {
        const ours = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));
        if (!ours.length) return;
        return AsyncStorage.multiGet(ours).then(entries => {
            for (const [key, value] of entries) {
                if (!value) continue;
                try {
                    const id = key.replace(CACHE_KEY_PREFIX, '');
                    diskCache[id] = JSON.parse(value);
                } catch {}
            }
        });
    })
    .catch(() => {});

/**
 * Hook to fetch supported chains from the Tiwi backend.
 * Persists per-type results to AsyncStorage so the home tile renders
 * instantly on cold start.
 */
export function useChains(type?: 'EVM' | 'Solana' | 'Cosmos' | 'TON' | 'TRON') {
    const cacheId = type || 'all';
    const cached = diskCache[cacheId];
    const hasSavedRef = useRef(false);

    const query = useQuery({
        queryKey: ['supportedChains', type],
        queryFn: async () => {
            const resp = await api.chains.list({ type });
            return resp.chains;
        },
        staleTime: 1000 * 60 * 60, // 1 hour - chains don't change often
        initialData: cached?.data,
        initialDataUpdatedAt: cached?.updatedAt,
    });

    useEffect(() => {
        if (query.data && !query.isPlaceholderData && query.dataUpdatedAt > (diskCache[cacheId]?.updatedAt || 0)) {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                const payload = { data: query.data, updatedAt: Date.now() };
                diskCache[cacheId] = payload;
                AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${cacheId}`, JSON.stringify(payload)).catch(() => {});
            }
        } else {
            hasSavedRef.current = false;
        }
    }, [query.data, query.dataUpdatedAt, cacheId]);

    return query;
}
