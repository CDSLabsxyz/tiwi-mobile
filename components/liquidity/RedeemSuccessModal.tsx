/**
 * RedeemSuccessModal - success screen shown after redeeming (withdrawing) a
 * liquidity position. Mirrors the create-flow Stage 3 success surface.
 */
import { colors } from '@/constants/colors';
import { Fonts } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface RedeemResult {
  pair: string;
  symbolA: string;
  symbolB: string;
  receivedA?: string;
  receivedB?: string;
  lpBurned: string;
  /** true when LP was actually burned on-chain (vs a pending/seed withdrawal). */
  onChain: boolean;
}

function fmtAmt(v?: string): string {
  const n = parseFloat(v || '0');
  if (!isFinite(n) || n === 0) return '0';
  if (n >= 1) return parseFloat(n.toFixed(4)).toString();
  return parseFloat(n.toFixed(8)).toString();
}

export function RedeemSuccessModal({
  result,
  onClose,
  onViewPools,
}: {
  result: RedeemResult | null;
  onClose: () => void;
  onViewPools: () => void;
}) {
  return (
    <Modal visible={!!result} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.outer} onPress={(e) => e.stopPropagation()}>
          {result ? (
            <View style={styles.inner}>
              <View style={styles.check}>
                <Ionicons name="checkmark" size={32} color="#010501" />
              </View>

              <Text style={styles.title}>
                {result.onChain ? 'Liquidity Redeemed' : 'Position Withdrawn'}
              </Text>
              <Text style={styles.sub}>
                {result.onChain
                  ? `Your ${result.pair} liquidity was burned and the underlying tokens (plus earned fees) were returned to your wallet.`
                  : `Your ${result.pair} position was withdrawn and removed from your open positions.`}
              </Text>

              <View style={styles.metrics}>
                <Row label="Pool" value={result.pair} />
                <Row label="LP Redeemed" value={fmtAmt(result.lpBurned)} />
                {result.onChain ? (
                  <>
                    <Row label={`${result.symbolA} Received`} value={`${fmtAmt(result.receivedA)} ${result.symbolA}`} />
                    <Row label={`${result.symbolB} Received`} value={`${fmtAmt(result.receivedB)} ${result.symbolB}`} />
                  </>
                ) : null}
              </View>

              <View style={styles.btns}>
                <TouchableOpacity style={styles.viewBtn} onPress={onViewPools}>
                  <Text style={styles.viewText}>View Pools</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  outer: { width: '100%', maxWidth: 420, borderRadius: 22, borderWidth: 1, borderColor: colors.bgStroke, backgroundColor: colors.bg, padding: 4 },
  inner: { borderRadius: 20, backgroundColor: '#071007', paddingHorizontal: 20, paddingVertical: 34, alignItems: 'center' },
  check: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: colors.primaryCTA, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primaryCTA, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  title: { color: colors.titleText, fontSize: 19, fontFamily: Fonts.semibold, marginTop: 24, textAlign: 'center' },
  sub: { color: colors.bodyText, fontSize: 13, fontFamily: Fonts.medium, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  metrics: { width: '100%', marginTop: 26, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  rowLabel: { color: colors.bodyText, fontSize: 13, fontFamily: Fonts.medium },
  rowValue: { color: colors.titleText, fontSize: 13, fontFamily: Fonts.medium, textAlign: 'right', flexShrink: 1 },
  btns: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 30, borderRadius: 18, borderWidth: 1, borderColor: colors.bgStroke, backgroundColor: colors.bg, padding: 8 },
  viewBtn: { flex: 1, height: 48, borderRadius: 13, backgroundColor: '#063D05', alignItems: 'center', justifyContent: 'center' },
  viewText: { color: colors.primaryCTA, fontSize: 14, fontFamily: Fonts.semibold },
  doneBtn: { flex: 1, height: 48, borderRadius: 13, backgroundColor: '#071007', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: colors.bodyText, fontSize: 14, fontFamily: Fonts.semibold },
});
