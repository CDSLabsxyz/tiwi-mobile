/**
 * Pools list — /pool
 * Ported from tiwi-user-app app/pool/page.tsx. Loads active pools
 * (enriched with on-chain reserves + analytics) and renders TVL / 24H Vol /
 * Avg APR summary + a searchable list. Rows deep-link to the pool detail.
 */
import { AprChip, PoolIdentity, ReserveBar, computeSummary, feeLevelLabel, formatUsd, poolRouteAddress } from '@/components/liquidity/shared';
import { CustomStatusBar } from '@/components/ui/custom-status-bar';
import { TIWILoader } from '@/components/ui/TIWILoader';
import { colors } from '@/constants/colors';
import { Fonts } from '@/theme';
import { bootstrapLiquidityAddresses } from '@/constants/liquidity';
import { api } from '@/lib/mobile/api-client';
import type { LiquidityPool } from '@/types/liquidity';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PoolsListScreen() {
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');

  // Populate factory/router addresses from the backend (env is the fallback).
  useEffect(() => { bootstrapLiquidityAddresses(); }, []);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['liquidityPools', 'active'],
    queryFn: async () => (await api.liquidity.listPools({ status: 'active', enrich: true })).pools,
    staleTime: 60_000,
  });

  const pools = data ?? [];
  const summary = useMemo(() => computeSummary(pools), [pools]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pools;
    return pools.filter(
      (p) => p.pair.toLowerCase().includes(q) || (p.chainName || '').toLowerCase().includes(q),
    );
  }, [pools, search]);

  const openPool = (p: LiquidityPool) => router.push(`/pool/${p.chainId}/${poolRouteAddress(p)}` as any);

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <CustomStatusBar />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.titleText} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Liquidity Pools</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primaryCTA} />}
      >
        {/* Hero card */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLbl}>Total Value Locked</Text>
              <Text style={styles.heroTvl}>{formatUsd(summary.tvlUsd)}</Text>
            </View>
            <View style={styles.poolsChip}>
              <Text style={styles.poolsChipText}>{pools.length} pools</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroStatV, { color: '#2FE29A' }]}>{formatUsd(summary.volume24hUsd)}</Text>
              <Text style={styles.heroStatK}>24H Volume</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroStatV, { color: colors.primaryCTA }]}>{summary.avgAprPct > 0 ? `${summary.avgAprPct.toFixed(2)}%` : '—'}</Text>
              <Text style={styles.heroStatK}>Avg APR</Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.mutedText} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by token"
            placeholderTextColor={colors.mutedText}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>All Pools</Text>
          <TouchableOpacity onPress={() => router.push('/pool/positions' as any)}>
            <Text style={styles.linkBtn}>View Positions</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 48 }}>
            <TIWILoader />
          </View>
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>{search ? 'No pools match your search.' : 'No pools yet. Be the first to create one.'}</Text>
        ) : (
          filtered.map((p) => (
            <TouchableOpacity key={p.id} style={styles.poolRow} onPress={() => openPool(p)} activeOpacity={0.7}>
              <View style={styles.poolRowHead}>
                <PoolIdentity pool={p} />
                <View style={styles.feePill}>
                  <Text style={styles.feePillText}>{feeLevelLabel(p)}</Text>
                </View>
              </View>
              <ReserveBar a={p.onChain?.reserveAFormatted} b={p.onChain?.reserveBFormatted} />
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>TVL</Text>
                  <Text style={styles.metricValue}>{formatUsd(p.tvlUsd)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>APR</Text>
                  <AprChip value={p.aprPct} />
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>24H Vol</Text>
                  <Text style={styles.metricValue}>{formatUsd(p.volume24hUsd)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Pinned Create Position */}
      <View style={styles.footerBar}>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/pool/create' as any)}>
          <Ionicons name="add" size={18} color="#04120A" />
          <Text style={styles.createBtnText}>Create Position</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 48 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.titleText, fontSize: 18, fontFamily: Fonts.semibold },

  // Hero
  hero: { position: 'relative', overflow: 'hidden', backgroundColor: colors.bgCards, borderRadius: 22, borderWidth: 1, borderColor: colors.bgStroke, padding: 18 },
  heroGlow: { position: 'absolute', top: -70, right: -50, width: 200, height: 160, borderRadius: 100, backgroundColor: 'rgba(177,241,40,0.10)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLbl: { color: colors.mutedText, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: Fonts.bold },
  heroTvl: { color: colors.titleText, fontSize: 30, fontFamily: Fonts.bold, marginTop: 6, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  poolsChip: { backgroundColor: 'rgba(177,241,40,0.08)', borderColor: 'rgba(177,241,40,0.3)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  poolsChipText: { color: colors.primaryCTA, fontSize: 11, fontFamily: Fonts.semibold },
  heroStats: { flexDirection: 'row', gap: 20, marginTop: 20 },
  heroStatV: { fontSize: 19, fontFamily: Fonts.semibold, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  heroStatK: { color: colors.mutedText, fontSize: 10, marginTop: 3, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: Fonts.medium },

  // Controls
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgCards, borderRadius: 13, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, height: 44, marginTop: 16 },
  searchInput: { flex: 1, color: colors.titleText, fontSize: 13, padding: 0, fontFamily: Fonts.regular },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 4 },
  panelTitle: { color: colors.titleText, fontSize: 15, fontFamily: Fonts.semibold },
  linkBtn: { color: colors.primaryCTA, fontSize: 13, fontFamily: Fonts.semibold },
  empty: { color: colors.mutedText, textAlign: 'center', paddingVertical: 40, fontSize: 13, fontFamily: Fonts.medium },

  // Pool row
  poolRow: { backgroundColor: colors.bgCards, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 12, gap: 12 },
  poolRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feePill: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  feePillText: { color: colors.mutedText, fontSize: 11, fontFamily: Fonts.semibold, fontVariant: ['tabular-nums'] },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border },
  metric: { gap: 3 },
  metricLabel: { color: colors.mutedText, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: Fonts.bold },
  metricValue: { color: colors.titleText, fontSize: 13, fontFamily: Fonts.semibold, fontVariant: ['tabular-nums'] },

  // Footer
  footerBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primaryCTA, borderRadius: 13, height: 50 },
  createBtnText: { color: '#04120A', fontSize: 15, fontFamily: Fonts.bold },
});
