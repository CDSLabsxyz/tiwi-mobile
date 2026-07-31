/**
 * PoolFeesCard — creator/platform protocol-fee claim UI.
 * Ported from tiwi-user-app app/pool/[chain]/[address]/pool-fees-card.tsx.
 * Renders nothing for pre-upgrade pools (readPoolFees → null).
 */
import { useLiquidityHub, type PoolFees } from '@/hooks/useLiquidityHub';
import { colors } from '@/constants/colors';
import { Fonts } from '@/theme';
import { useWalletStore } from '@/store/walletStore';
import type { LiquidityPool } from '@/types/liquidity';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatUnits, type Address } from 'viem';

export function PoolFeesCard({ pool }: { pool: LiquidityPool }) {
  const activeAddress = useWalletStore((s) => s.activeAddress);
  const { readPoolFees, claimCreatorFeesOnChain, claimPlatformFeesOnChain, isPending } = useLiquidityHub();
  const [fees, setFees] = useState<PoolFees | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<'creator' | 'platform' | null>(null);

  const pairAddress = pool.pairAddress as Address | undefined;
  const aIsToken0 = pool.onChain?.aIsToken0 ?? true;
  const decA = pool.tokenA.decimals ?? 18;
  const decB = pool.tokenB.decimals ?? 18;
  const token0Sym = aIsToken0 ? pool.tokenA.symbol : pool.tokenB.symbol;
  const token1Sym = aIsToken0 ? pool.tokenB.symbol : pool.tokenA.symbol;
  const dec0 = aIsToken0 ? decA : decB;
  const dec1 = aIsToken0 ? decB : decA;

  const load = useCallback(async () => {
    if (!pairAddress) return;
    setLoading(true);
    const f = await readPoolFees(pairAddress, pool.chainId);
    setFees(f);
    setLoading(false);
  }, [pairAddress, pool.chainId, readPoolFees]);

  useEffect(() => { load(); }, [load]);

  if (!pairAddress) return null;
  if (loading) {
    return (
      <View style={styles.card}><Text style={styles.title}>Protocol Fees</Text><Text style={styles.muted}>Loading…</Text></View>
    );
  }
  if (!fees) return null; // pre-upgrade pool

  const creatorAccrued = BigInt(fees.creator0) > 0n || BigInt(fees.creator1) > 0n;
  const platformAccrued = BigInt(fees.platform0) > 0n || BigInt(fees.platform1) > 0n;
  const isCreator = !!activeAddress && activeAddress.toLowerCase() === fees.creator.toLowerCase();

  const handleClaim = async (kind: 'creator' | 'platform') => {
    if (!pairAddress) return;
    setMessage(null); setBusyKind(kind);
    try {
      if (kind === 'creator') await claimCreatorFeesOnChain({ pairAddress, chainId: pool.chainId });
      else await claimPlatformFeesOnChain({ pairAddress, chainId: pool.chainId });
      setMessage('Fees claimed.');
      await load();
    } catch (e: any) {
      setMessage(e?.message || 'Claim failed');
    } finally {
      setBusyKind(null);
    }
  };

  const fmt = (raw: string, dec: number) => formatUnits(BigInt(raw), dec);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Protocol Fees</Text>
      <Text style={styles.muted}>
        A {(fees.creatorFeeShareBps / 100).toFixed(2)}% / {(fees.platformFeeShareBps / 100).toFixed(2)}% slice of each swap fee accrues to creator/platform. LPs keep the rest.
      </Text>

      {/* Creator */}
      <View style={styles.feeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.feeLabel}>Creator</Text>
          <Text style={styles.feeAmount}>{fmt(fees.creator0, dec0)} {token0Sym} + {fmt(fees.creator1, dec1)} {token1Sym}</Text>
        </View>
        {isCreator ? (
          <TouchableOpacity
            style={[styles.claimBtn, (!creatorAccrued || isPending) && styles.claimBtnDisabled]}
            disabled={!creatorAccrued || isPending}
            onPress={() => handleClaim('creator')}
          >
            {busyKind === 'creator' ? <ActivityIndicator size="small" color="#04120A" /> : <Text style={styles.claimBtnText}>Claim</Text>}
          </TouchableOpacity>
        ) : (
          <Text style={styles.mutedSmall}>Creator only</Text>
        )}
      </View>

      {/* Platform */}
      <View style={styles.feeRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.feeLabel}>Platform</Text>
          <Text style={styles.feeAmount}>{fmt(fees.platform0, dec0)} {token0Sym} + {fmt(fees.platform1, dec1)} {token1Sym}</Text>
        </View>
        <TouchableOpacity
          style={[styles.claimBtn, styles.claimBtnGhost, (!platformAccrued || isPending) && styles.claimBtnDisabled]}
          disabled={!platformAccrued || isPending}
          onPress={() => handleClaim('platform')}
        >
          {busyKind === 'platform' ? <ActivityIndicator size="small" color={colors.titleText} /> : <Text style={styles.claimBtnGhostText}>Send to treasury</Text>}
        </TouchableOpacity>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bgCards, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  title: { color: colors.titleText, fontSize: 15, fontFamily: Fonts.bold },
  muted: { color: colors.mutedText, fontSize: 11, marginTop: 6, lineHeight: 16 },
  mutedSmall: { color: colors.mutedText, fontSize: 11 },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  feeLabel: { color: colors.bodyText, fontSize: 12, fontFamily: Fonts.semibold },
  feeAmount: { color: colors.titleText, fontSize: 13, marginTop: 3 },
  claimBtn: { backgroundColor: colors.primaryCTA, borderRadius: 8, paddingHorizontal: 12, height: 34, alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  claimBtnText: { color: '#04120A', fontSize: 13, fontFamily: Fonts.bold },
  claimBtnGhost: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  claimBtnGhostText: { color: colors.titleText, fontSize: 12, fontFamily: Fonts.semibold },
  claimBtnDisabled: { opacity: 0.4 },
  message: { color: colors.bodyText, fontSize: 12, marginTop: 12 },
});
