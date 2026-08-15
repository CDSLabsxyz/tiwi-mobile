import { api } from '@/lib/mobile/api-client';
import type { ChartDataPoint, ChartTimePeriod } from '@/services/walletService';
import { useQuery } from '@tanstack/react-query';

/**
 * Real price history for the asset detail screen.
 *
 * `filled=false` is deliberate: the chart endpoint will otherwise pad thin or
 * missing series with synthesised bars (`chart-data-filler`), and a made-up
 * price line is worse than no line. What this returns is what actually traded -
 * an empty array means we say so on screen.
 */

/** Screen tab → the chart route's range preset. */
const RANGE_BY_PERIOD: Record<ChartTimePeriod, string> = {
    '1D': '1D',
    '1W': '1W',
    '1M': '1M',
    '1Y': '1Y',
    '5Y': '5Y',
    'All': 'ALL',
};

/** Longer windows can stay cached far longer - a daily bar moves once a day. */
const STALE_MS_BY_PERIOD: Record<ChartTimePeriod, number> = {
    '1D': 60_000,
    '1W': 5 * 60_000,
    '1M': 15 * 60_000,
    '1Y': 60 * 60_000,
    '5Y': 60 * 60_000,
    'All': 60 * 60_000,
};

export interface AssetChartResult {
    points: ChartDataPoint[];
    isLoading: boolean;
    isError: boolean;
    /** Change across the whole window, in percent (null when unknown). */
    changePercent: number | null;
}

export function useAssetChart(
    address: string | undefined,
    chainId: number | string | undefined,
    period: ChartTimePeriod,
): AssetChartResult {
    const numericChainId = Number(chainId);
    const enabled = !!address && Number.isFinite(numericChainId);

    const query = useQuery({
        queryKey: ['assetChart', numericChainId, address?.toLowerCase(), period],
        enabled,
        staleTime: STALE_MS_BY_PERIOD[period],
        gcTime: 60 * 60_000,
        retry: 1,
        queryFn: async () => {
            const res: any = await api.charts.token({
                baseToken: address!,
                quoteToken: 'USD',
                chainId: numericChainId,
                range: RANGE_BY_PERIOD[period],
                filled: false,
            });

            const points: ChartDataPoint[] = (res?.points || [])
                .map((p: any) => ({ timestamp: Number(p.time), value: Number(p.value) }))
                .filter((p: ChartDataPoint) => Number.isFinite(p.timestamp) && p.value > 0)
                .sort((a: ChartDataPoint, b: ChartDataPoint) => a.timestamp - b.timestamp);

            // One lone bar is the price-only fallback upstream, not a series.
            return {
                points: points.length > 1 ? points : [],
                changePercent: typeof res?.summary?.changePercent === 'number'
                    ? res.summary.changePercent
                    : null,
            };
        },
    });

    return {
        points: query.data?.points ?? [],
        isLoading: query.isLoading || query.isFetching,
        isError: query.isError,
        changePercent: query.data?.changePercent ?? null,
    };
}
