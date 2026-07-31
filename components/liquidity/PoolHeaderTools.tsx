/**
 * PoolHeaderTools — the pool-detail header row: global pool/token search,
 * an explorer (chart) menu (pool + both tokens), and a share button.
 * Ported from the web pool-detail PoolSearch + PoolRouteActions.
 */
import { colors } from '@/constants/colors';
import { Fonts } from '@/theme';
import { api, TIWI_API_BASE_URL } from '@/lib/mobile/api-client';
import type { LiquidityPool } from '@/types/liquidity';
import { ChainBadge, shortAddress } from './shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  56: 'https://bscscan.com',
  137: 'https://polygonscan.com',
  42161: 'https://arbiscan.io',
  8453: 'https://basescan.org',
  10: 'https://optimistic.etherscan.io',
  43114: 'https://snowtrace.io',
};

export function PoolHeaderTools({ pool }: { pool: LiquidityPool }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LiquidityPool[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setShowResults(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.liquidity.listPools({ search: term });
        setResults((r.pools || []).slice(0, 8));
        setShowResults(true);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const explorerBase = EXPLORERS[pool.chainId];
  const openExplorer = (addr?: string, isToken?: boolean) => {
    setShowExplorer(false);
    if (!explorerBase || !addr) return;
    Linking.openURL(`${explorerBase}/${isToken ? 'token' : 'address'}/${addr}`).catch(() => {});
  };

  const shareUrl = `${TIWI_API_BASE_URL}/pool/${pool.chainId}/${pool.pairAddress || pool.id}`;
  const onShare = () => {
    setShowExplorer(false); setShowResults(false);
    Share.share({ message: `${pool.pair} on TIWI Protocol — ${shareUrl}`, url: shareUrl }).catch(() => {});
  };

  const goPool = (p: LiquidityPool) => {
    setQ(''); setShowResults(false);
    router.push(`/pool/${p.chainId}/${p.pairAddress || p.id}` as any);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.mutedText} />
          <TextInput
            value={q}
            onChangeText={setQ}
            onFocus={() => { if (results.length) setShowResults(true); }}
            placeholder="Search tokens, pools"
            placeholderTextColor={colors.mutedText}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => { if (results[0]) goPool(results[0]); }}
          />
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => { setShowExplorer((v) => !v); setShowResults(false); }}>
          <Ionicons name="stats-chart" size={18} color={colors.titleText} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onShare}>
          <Ionicons name="share-social" size={18} color={colors.titleText} />
        </TouchableOpacity>
      </View>

      {showResults && results.length > 0 ? (
        <View style={styles.dropdown}>
          {results.map((p) => (
            <TouchableOpacity key={p.id} style={styles.dropRow} onPress={() => goPool(p)} activeOpacity={0.7}>
              <ChainBadge chainId={p.chainId} chainLogo={p.chainLogo} size={16} />
              <Text style={styles.dropPair} numberOfLines={1}>{p.pair}</Text>
              <Text style={styles.dropSub} numberOfLines={1}>{p.chainName}</Text>
              <Ionicons name="open-outline" size={15} color={colors.mutedText} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {showExplorer ? (
        <View style={[styles.dropdown, styles.explorerDrop]}>
          <ExplorerRow label="Pool" addr={pool.pairAddress || pool.id} onPress={() => openExplorer(pool.pairAddress || pool.id, false)} />
          <ExplorerRow label={pool.tokenA?.symbol || 'Token A'} addr={pool.tokenA?.address} onPress={() => openExplorer(pool.tokenA?.address, true)} />
          <ExplorerRow label={pool.tokenB?.symbol || 'Token B'} addr={pool.tokenB?.address} onPress={() => openExplorer(pool.tokenB?.address, true)} />
        </View>
      ) : null}
    </View>
  );
}

function ExplorerRow({ label, addr, onPress }: { label: string; addr?: string; onPress: () => void }) {
  if (!addr) return null;
  return (
    <TouchableOpacity style={styles.dropRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.explorerIcon}><Ionicons name="stats-chart" size={13} color={colors.primaryCTA} /></View>
      <Text style={styles.dropPair} numberOfLines={1}>{label}</Text>
      <Text style={styles.dropSub} numberOfLines={1}>{shortAddress(addr)}</Text>
      <Ionicons name="open-outline" size={15} color={colors.mutedText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 50, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgCards, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, color: colors.titleText, fontSize: 13, fontFamily: Fonts.regular, padding: 0 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgCards, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dropdown: {
    position: 'absolute', top: 52, left: 16, right: 16, backgroundColor: colors.bgCards, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 6, zIndex: 100, elevation: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  explorerDrop: { left: undefined, right: 16, width: 260 },
  dropRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  dropPair: { color: colors.titleText, fontSize: 14, fontFamily: Fonts.semibold },
  dropSub: { flex: 1, color: colors.mutedText, fontSize: 12, fontFamily: Fonts.medium },
  explorerIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bgShade20, alignItems: 'center', justifyContent: 'center' },
});
