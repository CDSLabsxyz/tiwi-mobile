import { apiClient } from '@/services/apiClient';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@tiwi/home-smartMarkets';

let diskCache: { data: any; updatedAt: number } | undefined;
AsyncStorage.getItem(CACHE_KEY)
    .then(value => {
        if (!value) return;
        try { diskCache = JSON.parse(value); } catch {}
    })
    .catch(() => {});

/**
 * useSmartMarkets Hook
 *
 * Fetches the list of supported DEXes and Bridges (Smart Markets) either
 * from LI.FI or the Tiwi Backend. Persists to AsyncStorage so the home
 * Smart Markets section renders instantly on cold start.
 */
export const useSmartMarkets = () => {
    const hasSavedRef = useRef(false);

    const query = useQuery({
        queryKey: ['smartMarkets'],
        queryFn: () => apiClient.getSmartMarkets(),
        staleTime: 24 * 60 * 60 * 1000, // 24 hours (supported tools don't change often)
        gcTime: 48 * 60 * 60 * 1000,
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
