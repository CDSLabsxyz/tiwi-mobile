/**
 * Shared liquidity UI helpers + primitives (ported from tiwi-user-app
 * app/pool/pools-data.ts + PoolIdentity). Formatters, pair-icon rows,
 * status badges, and deep-link param builders used across the pool screens.
 */
import { colors } from '@/constants/colors';
import { Fonts } from '@/theme';
import { TIWI_API_BASE_URL } from '@/lib/mobile/api-client';
import { feeBpsToLabel, type LiquidityPool, type LiquidityPositionStatus } from '@/types/liquidity';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

// ── Formatters ───────────────────────────────────────────────────────────────

export function formatUsd(n: number | undefined | null): string {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  if (v === 0) return '$0.00';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  if (v < 0.01) return `$${v.toFixed(6)}`;
  return `$${v.toFixed(2)}`;
}

export function formatPct(n: number | undefined | null): string {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '-';
  return `${n.toFixed(2)}%`;
}

export function splitPair(pair: string): [string, string] {
  const parts = (pair || '').split('/');
  return [parts[0] || '?', parts[1] || '?'];
}

export function shortAddress(addr?: string): string {
  if (!addr) return '';
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function computeSummary(pools: LiquidityPool[]): { tvlUsd: number; volume24hUsd: number; avgAprPct: number } {
  let tvlUsd = 0;
  let volume24hUsd = 0;
  const aprs: number[] = [];
  for (const p of pools) {
    tvlUsd += p.tvlUsd || 0;
    volume24hUsd += p.volume24hUsd || 0;
    if (p.aprPct && p.aprPct > 0) aprs.push(p.aprPct);
  }
  const avgAprPct = aprs.length ? aprs.reduce((a, b) => a + b, 0) / aprs.length : 0;
  return { tvlUsd, volume24hUsd, avgAprPct };
}

/** Route address used in navigation: pairAddress when deployed, else the row id. */
export function poolRouteAddress(pool: Pick<LiquidityPool, 'pairAddress' | 'id'>): string {
  return pool.pairAddress || pool.id;
}

/** Params for /pool/create when adding to an existing pool. */
export function addLiquidityParams(pool: LiquidityPool): Record<string, string> {
  return {
    aAddress: pool.tokenA.address,
    aSymbol: pool.tokenA.symbol || '',
    aLogo: pool.tokenA.logo || '',
    aDecimals: String(pool.tokenA.decimals ?? 18),
    bAddress: pool.tokenB.address,
    bSymbol: pool.tokenB.symbol || '',
    bLogo: pool.tokenB.logo || '',
    bDecimals: String(pool.tokenB.decimals ?? 18),
    chainId: String(pool.chainId),
    feeBps: String(pool.feeBps),
    pairAddress: pool.pairAddress || '',
    existing: '1',
  };
}

/**
 * Params for the Swap screen, pre-filled with THIS pool's pair. Mirrors the
 * web's `buildSwapHref`.
 *
 * When the pool is a real on-chain TIWI pair (`tradable` + a `pairAddress`) it
 * also carries `poolAddress` + `preferredRouter: 'tiwi-pool'`, which forces the
 * swap through that exact TiwiLiquidityPair instead of letting the aggregators
 * choose a venue. The backend re-checks the pair actually trades these two
 * tokens and falls back to normal routing otherwise, so pinning can only ever
 * narrow the route. Registry-only / external pools just pre-fill the tokens.
 */
export function poolSwapParams(pool: LiquidityPool): Record<string, string> {
  const params: Record<string, string> = {
    fromTokenAddress: pool.tokenA.address,
    fromChainId: String(pool.chainId),
    fromSymbol: pool.tokenA.symbol || '',
    fromLogo: pool.tokenA.logo || '',
    fromDecimals: String(pool.tokenA.decimals ?? 18),
    toTokenAddress: pool.tokenB.address,
    toChainId: String(pool.chainId),
    toSymbol: pool.tokenB.symbol || '',
    toLogo: pool.tokenB.logo || '',
    toDecimals: String(pool.tokenB.decimals ?? 18),
  };
  if (pool.tradable && pool.pairAddress) {
    params.poolAddress = pool.pairAddress;
    params.preferredRouter = 'tiwi-pool';
  }
  return params;
}

// ── Status badge ─────────────────────────────────────────────────────────────

/** Position badge follows the POOL's admin status, mirroring the web effectiveStatus. */
export function effectiveStatus(poolStatus: string | undefined, positionStatus: LiquidityPositionStatus): LiquidityPositionStatus {
  if (positionStatus === 'withdrawn') return 'withdrawn';
  switch (poolStatus) {
    case 'active': return 'verified';
    case 'rejected': return 'rejected';
    default: return 'pending';
  }
}

const STATUS_COPY: Record<LiquidityPositionStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  verified: { label: 'Verified', color: colors.success, icon: 'checkmark-circle' },
  pending: { label: 'Pending', color: '#F2B84B', icon: 'time' },
  rejected: { label: 'Rejected', color: colors.error, icon: 'close-circle' },
  withdrawn: { label: 'Withdrawn', color: colors.mutedText, icon: 'close-circle' },
};

export function StatusBadge({ status }: { status: LiquidityPositionStatus }) {
  const c = STATUS_COPY[status];
  return (
    <View style={[s.badge, { backgroundColor: `${c.color}18`, borderColor: `${c.color}55` }]}>
      <Ionicons name={c.icon} size={11} color={c.color} />
      <Text style={[s.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

// ── Token pair icons + identity ──────────────────────────────────────────────

function TokenLogo({ uri, size = 26, fallback }: { uri?: string; size?: number; fallback?: string }) {
  const resolved = resolveAssetUrl(uri);
  if (resolved) {
    return <RemoteIcon uri={resolved} size={size} background={colors.bgStroke} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bgStroke, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.bodyText, fontSize: size * 0.38, fontWeight: '700' }}>{(fallback || '?').slice(0, 1)}</Text>
    </View>
  );
}

export function TokenPairIcons({ pool, size = 26 }: { pool: Pick<LiquidityPool, 'tokenA' | 'tokenB' | 'pair'>; size?: number }) {
  const [aSym, bSym] = splitPair(pool.pair);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TokenLogo uri={pool.tokenA?.logo} size={size} fallback={pool.tokenA?.symbol || aSym} />
      <View style={{ marginLeft: -size * 0.35 }}>
        <TokenLogo uri={pool.tokenB?.logo} size={size} fallback={pool.tokenB?.symbol || bSym} />
      </View>
    </View>
  );
}

export function PoolIdentity({ pool, size = 26, showExternal = true }: { pool: LiquidityPool; size?: number; showExternal?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <TokenPairIcons pool={pool} size={size} />
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.pairLabel}>{pool.pair}</Text>
          {showExternal && pool.source === 'external' && (
            <View style={s.extBadge}>
              <Text style={s.extBadgeText}>{pool.dexName || 'External'}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <ChainBadge chainId={pool.chainId} chainLogo={pool.chainLogo} size={14} />
          <Text style={s.chainName}>{pool.chainName}</Text>
        </View>
      </View>
    </View>
  );
}

export const feeLevelLabel = (pool: LiquidityPool) => pool.feeLevel || feeBpsToLabel(pool.feeBps);

// ── Redesign primitives ──────────────────────────────────────────────────────

/** Resolve a possibly-relative asset path (e.g. "/assets/...") against the backend. */
export function resolveAssetUrl(u?: string): string | undefined {
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return `${TIWI_API_BASE_URL}${u}`;
  return u;
}

/** Render a remote icon: SvgUri for .svg (this project has no svg transformer,
 *  so expo-image can't rasterize svg), expo-image for raster formats. */
export function RemoteIcon({ uri, size, background }: { uri: string; size: number; background?: string }) {
  const isSvg = /\.svg(\?|#|$)/i.test(uri);
  if (isSvg) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: background }}>
        <SvgUri uri={uri} width={size} height={size} />
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: background }} contentFit="cover" />;
}

/** Chain icon: remote logo (svg or raster) → colored dot fallback. */
export function ChainBadge({ chainId, chainLogo, size = 14 }: { chainId?: number; chainLogo?: string; size?: number }) {
  const uri = resolveAssetUrl(chainLogo);
  if (uri) return <RemoteIcon uri={uri} size={size} />;
  return <View style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6), borderRadius: size, backgroundColor: chainColor(chainId) }} />;
}

/** Brand color per chain (for the chain dot + accents). */
export function chainColor(chainId?: number): string {
  switch (chainId) {
    case 1: return '#627EEA';      // Ethereum
    case 56: return '#F3BA2F';     // BNB
    case 137: return '#8247E5';    // Polygon
    case 42161: return '#2D9CDB';  // Arbitrum
    case 8453: return '#0052FF';   // Base
    case 10: return '#FF0420';     // Optimism
    case 43114: return '#E84142';  // Avalanche
    default: return colors.mutedText;
  }
}

/** APR as a green ▲ chip, or a muted dash when unavailable. */
export function AprChip({ value }: { value?: number | null }) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
    return <Text style={s.dash}>—</Text>;
  }
  return (
    <View style={s.aprChip}>
      <Text style={s.aprChipText}>▲ {value.toFixed(2)}%</Text>
    </View>
  );
}

/** Two-tone reserve balance bar. Widths from formatted reserve amounts. */
export function ReserveBar({ a, b, height = 8 }: { a?: string | number; b?: string | number; height?: number }) {
  const av = Math.max(0, parseFloat(String(a ?? 0)) || 0);
  const bv = Math.max(0, parseFloat(String(b ?? 0)) || 0);
  const total = av + bv;
  let pa = total > 0 ? (av / total) * 100 : 50;
  pa = Math.min(85, Math.max(15, pa)); // keep both segments visible
  return (
    <View style={[s.resBar, { height }]}>
      <View style={[s.resSegA, { width: `${pa}%` }]} />
      <View style={[s.resSegB, { width: `${100 - pa}%` }]} />
    </View>
  );
}

/** A small status pill with a leading dot (e.g. "Tradable"). */
export function StatusPill({ label, color = colors.success }: { label: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={[s.statusPillText, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 11, fontFamily: Fonts.semibold },
  pairLabel: { color: colors.titleText, fontSize: 14, fontFamily: Fonts.bold },
  chainName: { color: colors.mutedText, fontSize: 11, fontFamily: Fonts.medium },
  extBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.bgShade20, borderWidth: 1, borderColor: colors.bgStroke },
  extBadgeText: { color: colors.bodyText, fontSize: 9, fontFamily: Fonts.semibold },
  dash: { color: colors.mutedText, fontSize: 13, fontFamily: Fonts.medium },
  aprChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(63,234,155,0.10)', borderColor: 'rgba(63,234,155,0.25)', borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  aprChipText: { color: colors.success, fontSize: 11, fontFamily: Fonts.semibold, fontVariant: ['tabular-nums'] },
  resBar: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', backgroundColor: colors.bg, gap: 2 },
  resSegA: { height: '100%', backgroundColor: colors.primaryCTA, borderRadius: 4 },
  resSegB: { height: '100%', backgroundColor: '#2FE29A', borderRadius: 4 },
  statusPillText: { fontSize: 13, fontFamily: Fonts.bold },
});
