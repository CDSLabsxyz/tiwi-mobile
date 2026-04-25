import { api } from '@/lib/mobile/api-client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TWC Token Constants
const TWC_ADDRESS = '0xDA1060158F7D593667cCE0a15DB346BB3FfB3596';
const TWC_CHAIN_ID = 56; // BNB Chain

const CACHE_KEY = '@tiwi/home-twcToken';

let diskCache: { data: any; updatedAt: number } | undefined;
AsyncStorage.getItem(CACHE_KEY)
    .then(value => {
        if (!value) return;
        try { diskCache = JSON.parse(value); } catch {}
    })
    .catch(() => {});

/**
 * useTWCToken Hook
 *
 * Fetches detailed market statistics for the $TWC token. Persists the latest
 * payload to AsyncStorage so the home tile renders instantly on cold start.
 */
export const useTWCToken = () => {
    const hasSavedRef = useRef(false);

    const query = useQuery({
        queryKey: ['twcToken'],
        queryFn: async () => {
            const resp = await api.tokens.list({
                address: TWC_ADDRESS,
                chains: [TWC_CHAIN_ID],
                limit: 1
            });
            return resp.tokens.length > 0 ? resp.tokens[0] : null;
        },
        staleTime: 30 * 1000, // 30 seconds
        initialData: diskCache?.data,
        initialDataUpdatedAt: diskCache?.updatedAt,
    });

    useEffect(() => {
        if (query.data && !query.isPlaceholderData && query.dataUpdatedAt > (diskCache?.updatedAt || 0)) {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                const payload = { data: query.data, updatedAt: Date.now() };
                diskCache = payload;
                AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload)).catch(() => {});
            }
        } else {
            hasSavedRef.current = false;
        }
    }, [query.data, query.dataUpdatedAt]);

    return query;
};
