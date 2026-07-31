/**
 * Pool detail — /pool/[chain]/[address]
 * Ported from tiwi-user-app app/pool/[chain]/[address]/page.tsx.
 * Live reserves + status metrics (TVL / Fee APR / 24H+30D volume / fee level)
 * + a polling transactions table. Swap / Add Liquidity actions in the header.
 */
import { addLiquidityParams, formatPct, formatUsd, PoolIdentity, ReserveBar, shortAddress, splitPair, StatusPill } from '@/components/liquidity/shared';
import { PoolFeesCard } from '@/components/liquidity/PoolFeesCard';
import { PoolHeaderTools } from '@/components/liquidity/PoolHeaderTools';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { Fonts } from '@/theme';
import { api } from '@/lib/mobile/api-client';
import { feeBpsToLabel, type LiquidityPool } from '@/types/liquidity';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const secs = Math.floor(Date.now() / 1000 - ts);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function PoolDetailScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { chain, address } = useLocalSearchParams<{ chain: string; address: string }>();

  const { data: pool, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['liquidityPool', chain, address],
    queryFn: async () => {
      // Guard against a hung/slow enrich (on-chain reads) or an unreachable
      // backend — turn an infinite wait into a surfaced error after 20s.
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('Request timed out. Check your connection and try again.')), 20_000),
      );
      const res = await Promise.race([api.liquidity.poolByRoute(chain!, address!), timeout]);
      const p = (res as { pool: LiquidityPool | null }).pool;
      if (!p) throw new Error('Pool not found.');
      return p;
    },
    enabled: !!chain && !!address,
    staleTime: 30_000,
    retry: 1,
  });

  // The swaps route resolves by chain id (the slug can 404), so prefer the id.
  const chainForSwaps = String(pool?.chainId ?? chain);
  const swapAddr = pool?.pairAddress || address;
  const { data: swapsData } = useQuery({
    queryKey: ['poolSwaps', chainForSwaps, swapAddr],
    queryFn: async () => (await api.liquidity.poolSwaps(chainForSwaps!, swapAddr!, 50)).swaps,
    enabled: !!pool?.pairAddress,
    refetchInterval: 15_000,
  });
  const swaps = swapsData ?? [];

  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: top }]}>
        <CustomStatusBar />
        <View style={{ flex: 1, justifyContent: 'center' }}><TIWILoader /></View>
      </View>
    );
  }

  if (isError || !pool) {
    return (
      <View style={[styles.root, { paddingTop: top }]}>
        <CustomStatusBar />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.titleText} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Pool</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.mutedText} />
          <Text style={styles.errTitle}>Couldn&apos;t load this pool</Text>
          <Text style={styles.errMsg}>{(error as Error)?.message || 'Something went wrong.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Ionicons name="refresh" size={16} color="#04120A" />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [aSym, bSym] = splitPair(pool.pair);
  const reserveA = pool.onChain?.reserveAFormatted ?? pool.seedAmountA;
  const reserveB = pool.onChain?.reserveBFormatted ?? pool.seedAmountB;

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <CustomStatusBar />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.titleText} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{pool.pair} <Text style={styles.topAddr}>{shortAddress(swapAddr)}</Text></Text>
        <View style={{ width: 32 }} />
      </View>

      <PoolHeaderTools pool={pool} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primaryCTA} />}
      >
        {/* Title + actions */}
        <View style={styles.titleRow}>
          <PoolIdentity pool={pool} size={34} />
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.swapBtn} onPress={() => router.push('/swap' as any)}>
            <Ionicons name="swap-horizontal" size={16} color={colors.titleText} />
            <Text style={styles.swapBtnText}>Swap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/pool/create', params: addLiquidityParams(pool) } as any)}
          >
            <Ionicons name="add" size={16} color="#04120A" />
            <Text style={styles.addBtnText}>Add Liquidity</Text>
          </TouchableOpacity>
        </View>

        {/* Reserves */}
        <View style={styles.card}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardLbl}>Pool Reserves</Text>
            <Text style={styles.cardTag}>{pool.tradable ? 'live' : 'seeded'}</Text>
          </View>
          <View style={styles.reserveGrid}>
            <View style={styles.reserveTile}>
              <Text style={styles.reserveSym}>{aSym}</Text>
              <Text style={styles.reserveVal} numberOfLines={1}>{reserveA}</Text>
            </View>
            <View style={styles.reserveTile}>
              <Text style={styles.reserveSym}>{bSym}</Text>
              <Text style={styles.reserveVal} numberOfLines={1}>{reserveB}</Text>
            </View>
          </View>
          <ReserveBar a={reserveA} b={reserveB} height={9} />
          {pool.startingPrice ? (
            <Text style={styles.startPrice}>Starting price: {pool.startingPrice} {aSym} = 1 {bSym}</Text>
          ) : null}
        </View>

        {/* Status + metrics */}
        <View style={styles.card}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <StatusPill label={pool.tradable ? 'Tradable' : String(pool.status)} color={pool.tradable ? '#2FE29A' : colors.mutedText} />
          </View>
          <View style={styles.divider} />
          <MetricRow label="Total Value Locked" value={formatUsd(pool.tvlUsd)} />
          <MetricRow label="Fee APR (24H)" value={formatPct(pool.aprPct)} />
          <MetricRow label="24H Volume" value={formatUsd(pool.volume24hUsd)} />
          <MetricRow label="30D Volume" value={formatUsd(pool.volume30dUsd)} />
          <MetricRow label="Fee Level" value={pool.feeLevel || feeBpsToLabel(pool.feeBps)} last />
        </View>

        {/* Protocol / creator fees (claim) */}
        {pool.tradable && pool.pairAddress ? <PoolFeesCard pool={pool} /> : null}

        {/* Transactions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transactions</Text>
          {swaps.length === 0 ? (
            <Text style={styles.empty}>{pool.pairAddress ? 'No transactions yet.' : 'Registry pool — no on-chain swaps.'}</Text>
          ) : (
            swaps.map((sw) => (
              <View key={`${sw.txHash}-${sw.blockNumber}`} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txSwap} numberOfLines={1}>
                    {sw.amountIn} {sw.tokenInSymbol} → {sw.amountOut} {sw.tokenOutSymbol}
                  </Text>
                  <Text style={styles.txAccount}>{shortAddress(sw.sender)} · {timeAgo(sw.timestamp)}</Text>
                </View>
                <Text style={styles.txValue}>{formatUsd(sw.valueUsd)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function MetricRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.metricRow, !last && styles.metricRowBorder]}>
      <Text style={styles.metricRowLabel}>{label}</Text>
      <Text style={styles.metricRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 48 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.titleText, fontSize: 15, fontFamily: Fonts.bold, flex: 1, textAlign: 'center' },
  topAddr: { color: colors.mutedText, fontSize: 12, fontFamily: Fonts.regular },
  titleRow: { marginTop: 8, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  swapBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.bgCards, borderWidth: 1, borderColor: colors.border, borderRadius: 10, height: 42 },
  swapBtnText: { color: colors.titleText, fontSize: 14, fontFamily: Fonts.semibold },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primaryCTA, borderRadius: 10, height: 42 },
  addBtnText: { color: '#04120A', fontSize: 14, fontFamily: Fonts.bold },
  card: { backgroundColor: colors.bgCards, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  cardTitle: { color: colors.titleText, fontSize: 15, fontFamily: Fonts.bold },
  cardSub: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLbl: { color: colors.mutedText, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: Fonts.bold },
  cardTag: { color: '#2FE29A', fontSize: 11, fontFamily: Fonts.semibold, borderWidth: 1, borderColor: 'rgba(47,226,154,0.25)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  reserveGrid: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 12 },
  reserveTile: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
  reserveSym: { color: colors.bodyText, fontSize: 12, fontFamily: Fonts.semibold },
  reserveVal: { color: colors.titleText, fontSize: 15, fontFamily: Fonts.bold, marginTop: 4 },
  startPrice: { color: colors.mutedText, fontSize: 11, marginTop: 12 },
  statusLabel: { color: colors.mutedText, fontSize: 12 },
  statusValue: { color: colors.success, fontSize: 18, fontFamily: Fonts.bold, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  metricRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  metricRowLabel: { color: colors.bodyText, fontSize: 13 },
  metricRowValue: { color: colors.titleText, fontSize: 14, fontFamily: Fonts.semibold },
  empty: { color: colors.mutedText, fontSize: 12, paddingVertical: 20, textAlign: 'center' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  txSwap: { color: colors.titleText, fontSize: 13, fontFamily: Fonts.medium },
  txAccount: { color: colors.mutedText, fontSize: 11, marginTop: 2 },
  txValue: { color: colors.success, fontSize: 13, fontFamily: Fonts.semibold },
  errWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errTitle: { color: colors.titleText, fontSize: 16, fontFamily: Fonts.bold, marginTop: 14 },
  errMsg: { color: colors.mutedText, fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryCTA, borderRadius: 12, height: 44, paddingHorizontal: 22, marginTop: 22 },
  retryText: { color: '#04120A', fontSize: 14, fontFamily: Fonts.bold },
  backLink: { color: colors.mutedText, fontSize: 13, fontFamily: Fonts.semibold },
});
