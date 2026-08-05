/**
 * Positions — /pool/positions
 * Ported from tiwi-user-app app/pool/positions/page.tsx.
 * Lists a wallet's open LP positions with LP/share stats + filter tabs, and
 * wires Add / Withdraw (on-chain removeLiquidity) / Manage per position.
 */
import { addLiquidityParams, effectiveStatus, formatPct, PoolIdentity, StatusBadge } from '@/components/liquidity/shared';
import { RedeemSuccessModal, type RedeemResult } from '@/components/liquidity/RedeemSuccessModal';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { Fonts } from '@/theme';
import { useLiquidityHub } from '@/hooks/useLiquidityHub';
import { api } from '@/lib/mobile/api-client';
import { useWalletStore } from '@/store/walletStore';
import type { LiquidityPool, LiquidityPosition, LiquidityPositionStatus } from '@/types/liquidity';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUnits, type Address } from 'viem';

type FilterKey = 'all' | 'verified' | 'pending' | 'rejected';
const FILTERS: FilterKey[] = ['all', 'verified', 'pending', 'rejected'];

function isOpen(p: LiquidityPosition): boolean {
  if (p.status === 'withdrawn') return false;
  if (p.pool?.tradable && p.onChain && BigInt(p.onChain.lpBalance || '0') === 0n) return false;
  return true;
}

export default function PositionsScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { address, walletGroups, activeGroupId } = useWalletStore();
  const { removeLiquidityOnChain } = useLiquidityHub();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [redeemResult, setRedeemResult] = useState<RedeemResult | null>(null);

  const wallet = useMemo(() => {
    const group = walletGroups.find((g) => g.id === activeGroupId);
    return group?.addresses?.EVM || address || null;
  }, [walletGroups, activeGroupId, address]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['liquidityPositions', wallet],
    queryFn: async () => (await api.liquidity.listPositions({ userWallet: wallet!, enrich: true })).positions,
    enabled: !!wallet,
    staleTime: 30_000,
  });

  const positions = useMemo(() => (data ?? []).filter(isOpen), [data]);

  const stats = useMemo(() => {
    const lpMinted = positions.reduce((sum, p) => sum + parseFloat(p.lpTokens || '0'), 0);
    const pending = positions.filter((p) => effectiveStatus(p.pool?.status, p.status) === 'pending').length;
    return { count: positions.length, lpMinted, pending };
  }, [positions]);

  const filtered = useMemo(() => {
    if (filter === 'all') return positions;
    return positions.filter((p) => effectiveStatus(p.pool?.status, p.status) === filter);
  }, [positions, filter]);

  const withdraw = async (p: LiquidityPosition) => {
    setActionError(null);
    setBusyId(p.id);
    try {
      const pool = p.pool;
      const lpBalance = p.onChain?.lpBalance;
      const didBurn = !!(pool?.tradable && pool.pairAddress && pool.chainId && lpBalance && BigInt(lpBalance) > 0n);
      if (didBurn) {
        const { txHash } = await removeLiquidityOnChain({
          chainId: pool!.chainId!,
          pairAddress: pool!.pairAddress as Address,
          liquidity: formatUnits(BigInt(lpBalance!), 18),
        });
        // Record in the activities board — "Removed liquidity". Best-effort.
        if (txHash && wallet) {
          void api.wallet.logTransaction({
            walletAddress: wallet,
            transactionHash: txHash,
            chainId: pool!.chainId!,
            type: 'RemoveLiquidity',
            fromTokenAddress: pool?.tokenA?.address,
            fromTokenSymbol: pool?.tokenA?.symbol,
            toTokenAddress: pool?.tokenB?.address,
            toTokenSymbol: pool?.tokenB?.symbol,
            amount: p.onChain?.redeemableA ?? p.amountA ?? '0',
            amountFormatted: `${p.onChain?.redeemableA ?? p.amountA ?? '0'} ${pool?.tokenA?.symbol ?? ''}`.trim(),
            // The B-side amount, same as the web records.
            toAmountFormatted: p.onChain?.redeemableB ?? p.amountB ?? undefined,
            routerName: pool?.pair,
            poolAddress: pool?.pairAddress,
            blockTimestamp: new Date().toISOString(),
          }).catch(() => { /* tracking is best-effort */ });
        }
      }
      await api.liquidity.updatePosition({ id: p.id, status: 'withdrawn' });
      setRedeemResult({
        pair: pool?.pair || `${pool?.tokenA?.symbol || ''}/${pool?.tokenB?.symbol || ''}`,
        symbolA: pool?.tokenA?.symbol || 'Token A',
        symbolB: pool?.tokenB?.symbol || 'Token B',
        receivedA: p.onChain?.redeemableA,
        receivedB: p.onChain?.redeemableB,
        lpBurned: lpBalance ? formatUnits(BigInt(lpBalance), 18) : (p.lpTokens || '0'),
        onChain: didBurn,
      });
      await refetch();
    } catch (e: any) {
      setActionError(e?.message || 'Withdraw failed');
    } finally {
      setBusyId(null);
    }
  };

  const withdrawLabel = (status: LiquidityPositionStatus) =>
    status === 'rejected' ? 'Withdraw Tokens' : status === 'pending' ? 'Withdraw Seed' : 'Redeem';

  const count = (f: FilterKey) => f === 'all' ? positions.length : positions.filter((p) => effectiveStatus(p.pool?.status, p.status) === f).length;

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <CustomStatusBar />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.titleText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Positions</Text>
        <TouchableOpacity onPress={() => router.push('/pool/create' as any)} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="add" size={22} color={colors.primaryCTA} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primaryCTA} />}
      >
        {!wallet ? (
          <Text style={styles.empty}>Connect a wallet to view your positions.</Text>
        ) : isLoading ? (
          <View style={{ paddingVertical: 48 }}><TIWILoader /></View>
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <Stat label="Positions" value={String(stats.count)} />
              <Stat label="LP minted" value={stats.lpMinted.toFixed(4)} accent />
              <Stat label="Pending" value={String(stats.pending)} />
            </View>

            {/* Filter tabs */}
            <View style={styles.tabs}>
              {FILTERS.map((f) => (
                <TouchableOpacity key={f} style={[styles.tab, filter === f && styles.tabActive]} onPress={() => setFilter(f)}>
                  <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
                    {f[0].toUpperCase() + f.slice(1)} {count(f)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {actionError ? <Text style={styles.errorBanner}>{actionError}</Text> : null}

            {filtered.length === 0 ? (
              <Text style={styles.empty}>No positions{filter !== 'all' ? ` (${filter})` : ''}.</Text>
            ) : (
              filtered.map((p) => {
                const status = effectiveStatus(p.pool?.status, p.status);
                const share = p.onChain?.sharePct ?? p.poolShare;
                const canManage = p.pool?.chainId && (p.pool?.pairAddress || p.poolId);
                return (
                  <View key={p.id} style={styles.posCard}>
                    <View style={styles.posHead}>
                      {p.pool ? <PoolIdentity pool={p.pool as LiquidityPool} /> : <Text style={styles.pairFallback}>Pool</Text>}
                      <StatusBadge status={status} />
                    </View>
                    <View style={styles.posMetrics}>
                      <Metric label="LP Tokens" value={parseFloat(p.lpTokens || '0').toFixed(4)} />
                      <Metric label="Share" value={formatPct(parseFloat(share || '0'))} accent />
                      <Metric label="Deposited" value={`${p.amountA} / ${p.amountB}`} />
                    </View>
                    <View style={styles.posActions}>
                      <TouchableOpacity
                        style={styles.addSmall}
                        onPress={() => p.pool && router.push({ pathname: '/pool/create', params: addLiquidityParams(p.pool as LiquidityPool) } as any)}
                      >
                        <Ionicons name="add" size={15} color="#04120A" />
                        <Text style={styles.addSmallText}>Add</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.withdrawBtn} disabled={busyId === p.id} onPress={() => withdraw(p)}>
                        {busyId === p.id ? <ActivityIndicator size="small" color={colors.success} /> : <Text style={styles.withdrawText}>{withdrawLabel(status)}</Text>}
                      </TouchableOpacity>
                      {canManage ? (
                        <TouchableOpacity
                          style={styles.manageBtn}
                          onPress={() => router.push(`/pool/${p.pool!.chainId}/${p.pool!.pairAddress || p.poolId}` as any)}
                        >
                          <Text style={styles.manageText}>Manage</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <RedeemSuccessModal
        result={redeemResult}
        onClose={() => setRedeemResult(null)}
        onViewPools={() => { setRedeemResult(null); router.push('/pool' as any); }}
      />
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.primaryCTA }]}>{value}</Text>
    </View>
  );
}
function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && { color: colors.success }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 48 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.titleText, fontSize: 16, fontFamily: Fonts.bold },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.bgCards, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
  statLabel: { color: colors.mutedText, fontSize: 11 },
  statValue: { color: colors.titleText, fontSize: 18, fontFamily: Fonts.bold, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primaryCTA, borderColor: colors.primaryCTA },
  tabText: { color: colors.bodyText, fontSize: 12, fontFamily: Fonts.semibold },
  tabTextActive: { color: '#04120A' },
  errorBanner: { color: colors.error, fontSize: 12, marginTop: 12 },
  empty: { color: colors.mutedText, textAlign: 'center', paddingVertical: 40, fontSize: 13 },
  posCard: { backgroundColor: colors.bgCards, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 14 },
  posHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pairFallback: { color: colors.titleText, fontSize: 14, fontFamily: Fonts.bold },
  posMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metric: { minWidth: '30%' },
  metricLabel: { color: colors.mutedText, fontSize: 10 },
  metricValue: { color: colors.titleText, fontSize: 13, fontFamily: Fonts.semibold, marginTop: 2 },
  posActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  addSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryCTA, borderRadius: 8, paddingHorizontal: 12, height: 36 },
  addSmallText: { color: '#04120A', fontSize: 13, fontFamily: Fonts.bold },
  withdrawBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgShade20, borderRadius: 8, height: 36 },
  withdrawText: { color: colors.success, fontSize: 13, fontFamily: Fonts.semibold },
  manageBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, height: 36 },
  manageText: { color: colors.titleText, fontSize: 13, fontFamily: Fonts.semibold },
});
